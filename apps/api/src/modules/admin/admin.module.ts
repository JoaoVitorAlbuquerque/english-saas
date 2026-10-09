import { Module } from '@nestjs/common';

import { AiModule } from 'src/modules/ai/ai.module';
import { BillingModule } from 'src/modules/billing/billing.module';
import { LearningModule } from 'src/modules/learning/learning.module';
import { PlannerModule } from 'src/modules/planner/planner.module';
import { ProgressModule } from 'src/modules/progress/progress.module';
import { UsersModule } from 'src/modules/users/users.module';

import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminStudentsController } from './controllers/admin-students.controller';

/**
 * Módulo 17 — admin.
 *
 * Só HTTP: a ficha do aluno e o log de auditoria juntam serviços de vários
 * módulos, por isso este módulo vem depois de todos. Regra de negócio e dado
 * continuam nos donos; as rotas de plano, créditos e métricas ficam nos
 * módulos 11 e 14 (`admin/billing`, `admin/metrics`).
 */
@Module({
  imports: [
    UsersModule,
    PlannerModule,
    LearningModule,
    ProgressModule,
    BillingModule,
    AiModule,
  ],
  controllers: [AdminStudentsController, AdminAuditController],
})
export class AdminModule {}
