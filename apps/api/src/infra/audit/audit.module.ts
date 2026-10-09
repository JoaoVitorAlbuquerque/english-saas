import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service';

/**
 * Trilha de auditoria. Global como o Prisma: o billing, o progress e o admin
 * registram sem importar uns aos outros (a ordem de dependência dos módulos
 * continua valendo). Só depende do Prisma.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
