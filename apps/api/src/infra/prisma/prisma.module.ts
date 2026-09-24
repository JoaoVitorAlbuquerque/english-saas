import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Prisma é global, mas o acesso é disciplinado: cada módulo só lê e escreve
 * nas tabelas que ele possui. Para dados de outro módulo, use o serviço
 * exportado por aquele módulo (ver CLAUDE.md → Convenções).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
