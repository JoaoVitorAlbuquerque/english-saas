import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Usado pelo health check. Não depende de nenhuma tabela existir. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  /**
   * Esvazia todas as tabelas do schema `public`, respeitando as FKs.
   * Só existe para os testes e2e — recusa rodar fora de NODE_ENV=test.
   */
  async truncateAllTables(): Promise<void> {
    if (process.env['NODE_ENV'] !== 'test') {
      throw new Error(
        'truncateAllTables só pode rodar com NODE_ENV=test — seria destrutivo aqui.',
      );
    }

    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `;

    if (tables.length === 0) {
      return;
    }

    const quoted = tables
      .map((table) => `"public"."${table.tablename}"`)
      .join(', ');

    await this.$executeRawUnsafe(
      `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
    );
  }
}
