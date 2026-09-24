import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { setupSwagger } from 'src/common/swagger/setup-swagger';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  /** Esvazia todas as tabelas. Chame entre suítes, nunca fora de teste. */
  resetDatabase: () => Promise<void>;
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
  const resetDatabase = () => prisma.truncateAllTables();

  await resetDatabase();

  return {
    app,
    prisma,
    resetDatabase,
    close: async () => {
      await resetDatabase();
      await app.close();
    },
  };
}
