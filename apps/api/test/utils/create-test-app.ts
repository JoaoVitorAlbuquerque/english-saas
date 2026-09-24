import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Response } from 'supertest';

import { AppModule } from 'src/app.module';
import { setupSwagger } from 'src/common/swagger/setup-swagger';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';

export type TestApp = {
  app: INestApplication;
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
};

/**
 * Sobe a aplicação inteira contra o banco de teste. Cada suíte e2e começa
 * com o banco limpo e o deixa limpo ao sair — suíte não herda sujeira de
 * suíte.
 */
export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();

  // Mesmo middleware do bootstrap: sem ele o refresh por cookie não roda.
  app.use(cookieParser());

  if (options.swagger === true) {
    setupSwagger(app, 'http://localhost:3333');
  }

  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);

  const resetDatabase = () => prisma.truncateAllTables();

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
