import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

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

  const app = moduleRef.createNestApplication();

  if (options.swagger === true) {
    setupSwagger(app, 'http://localhost:3333');
  }

  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);

  const resetDatabase = () => prisma.truncateAllTables();

  const flushAiCache = async (): Promise<void> => {
    const keys = await redis.client.keys('ai:*');

    if (keys.length > 0) {
      await redis.client.del(...keys);
    }
  };

  await resetDatabase();
  await flushAiCache();

  return {
    app,
    prisma,
    resetDatabase,
    flushAiCache,
    close: async () => {
      await resetDatabase();
      await flushAiCache();
      await app.close();
    },
  };
}
