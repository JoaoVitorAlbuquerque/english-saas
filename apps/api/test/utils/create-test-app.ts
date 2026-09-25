import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Queue } from 'bullmq';
import type { Response } from 'supertest';

import { AppModule } from 'src/app.module';
import {
  ACCESS_POLICY,
  DenyAllAccessPolicy,
} from 'src/common/access/access-policy';
import { setupSwagger } from 'src/common/swagger/setup-swagger';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { REGISTERED_QUEUES } from 'src/infra/queue/queues';
import { RedisService } from 'src/infra/redis/redis.service';

import { FakeAccessPolicy } from './fake-access-policy';

export type TestApp = {
  app: INestApplication;
  /** A política fake, quando é ela que está ligada. */
  accessPolicy: FakeAccessPolicy | null;
  prisma: PrismaService;
  /** Esvazia todas as tabelas. Chame entre suítes, nunca fora de teste. */
  resetDatabase: () => Promise<void>;
  /** Apaga as chaves de cache de IA do Redis. */
  flushAiCache: () => Promise<void>;
  /**
   * Apaga o cache do catálogo.
   *
   * A chave é `catalog:lesson:<slug>:v<versão>`, o que basta em produção —
   * versão publicada não se edita, então o conteúdo daquela chave é
   * imutável. No teste não basta: o banco é zerado e o mesmo slug volta com
   * uuid novo, então sem isto uma suíte lê a lição da anterior.
   */
  flushCatalogCache: () => Promise<void>;
  /**
   * Zera o contador do rate limit.
   *
   * Todas as requisições do e2e saem de 127.0.0.1 e o contador vive no
   * Redis, então sem isto uma suíte estoura o limite da seguinte.
   */
  resetRateLimit: () => Promise<void>;
  close: () => Promise<void>;
};

export type CreateTestAppOptions = {
  /** Monta o Swagger em /docs, como o bootstrap faz. */
  swagger?: boolean;
  /**
   * Política de acesso por plano. `fake` (padrão) libera tudo, com negação
   * por aluno via `accessPolicy.deny`; `real` usa a do billing; `none` usa a
   * que nega tudo — o que o app tem quando nada é ligado.
   */
  accessPolicy?: 'fake' | 'real' | 'none';
};

/**
 * Sobe a aplicação inteira contra o banco de teste. Cada suíte e2e começa
 * com o banco limpo e o deixa limpo ao sair — suíte não herda sujeira de
 * suíte.
 */
export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<TestApp> {
  const mode = options.accessPolicy ?? 'fake';
  const fakePolicy = mode === 'fake' ? new FakeAccessPolicy() : null;
  let builder = Test.createTestingModule({ imports: [AppModule] });

  if (fakePolicy !== null) {
    builder = builder.overrideProvider(ACCESS_POLICY).useValue(fakePolicy);
  } else if (mode === 'none') {
    builder = builder
      .overrideProvider(ACCESS_POLICY)
      .useClass(DenyAllAccessPolicy);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();

  // Mesmo middleware do bootstrap: sem ele o refresh por cookie não roda.
  app.use(cookieParser());

  if (options.swagger === true) {
    setupSwagger(app, 'http://localhost:3333');
  }

  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);

  const queues = REGISTERED_QUEUES.flatMap((name) => {
    try {
      return [app.get<Queue>(getQueueToken(name), { strict: false })];
    } catch {
      return [];
    }
  });

  /**
   * Trunca com as filas paradas. Um worker no meio de uma transação (o
   * crédito do mês que todo signup enfileira, por exemplo) e o TRUNCATE
   * disputam as mesmas tabelas e o Postgres acusa deadlock. Pausar impede
   * pegar job novo; esperar os ativos terminarem fecha a janela.
   */
  const resetDatabase = async (): Promise<void> => {
    await Promise.all(queues.map((queue) => queue.pause()));

    try {
      const deadline = Date.now() + 10_000;

      for (const queue of queues) {
        while ((await queue.getActiveCount()) > 0 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      await prisma.truncateAllTables();
    } finally {
      await Promise.all(queues.map((queue) => queue.resume()));
    }
  };

  const flushKeys = async (pattern: string): Promise<void> => {
    const keys = await redis.client.keys(pattern);

    if (keys.length > 0) {
      await redis.client.del(...keys);
    }
  };

  const flushAiCache = () => flushKeys('ai:*');
  const flushCatalogCache = () => flushKeys('catalog:*');

  // O @nest-lab/throttler-storage-redis grava em `{<key>:<name>}:hits`.
  const resetRateLimit = async (): Promise<void> => {
    const keys = await redis.client.keys('{*');

    if (keys.length > 0) {
      await redis.client.del(...keys);
    }
  };

  await resetDatabase();
  await flushAiCache();
  await flushCatalogCache();
  await resetRateLimit();

  return {
    app,
    accessPolicy: fakePolicy,
    prisma,
    resetDatabase,
    flushAiCache,
    flushCatalogCache,
    resetRateLimit,
    close: async () => {
      await resetDatabase();
      await flushAiCache();
      await flushCatalogCache();
      await resetRateLimit();
      await app.close();
    },
  };
}

export type ParsedCookies = {
  /** Valor de cada cookie, já decodificado. */
  values: Record<string, string>;
  /** `Set-Cookie` cru, para conferir HttpOnly, SameSite e Path. */
  raw: Record<string, string>;
  /** Header `Cookie` pronto para a próxima requisição. */
  header: string;
  refreshToken: string;
  csrfToken: string;
};

/** Lê os `Set-Cookie` de uma resposta do supertest. */
export function extractCookies(response: Response): ParsedCookies {
  const setCookie = response.headers['set-cookie'] as unknown;
  const list = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  const values: Record<string, string> = {};
  const raw: Record<string, string> = {};

  for (const cookie of list) {
    const [pair] = cookie.split(';');
    const separator = pair?.indexOf('=') ?? -1;

    if (pair === undefined || separator === -1) {
      continue;
    }

    const name = pair.slice(0, separator);
    values[name] = decodeURIComponent(pair.slice(separator + 1));
    raw[name] = cookie;
  }

  const header = Object.entries(values)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');

  return {
    values,
    raw,
    header,
    refreshToken: values['refresh_token'] ?? '',
    csrfToken: values['csrf_token'] ?? '',
  };
}
