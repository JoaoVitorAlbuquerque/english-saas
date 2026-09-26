import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AiModule } from 'src/modules/ai/ai.module';
import { AssessmentModule } from 'src/modules/assessment/assessment.module';
import { BillingModule } from 'src/modules/billing/billing.module';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { LearnerModelModule } from 'src/modules/learner-model/learner-model.module';
import { LearningModule } from 'src/modules/learning/learning.module';
import { PlannerModule } from 'src/modules/planner/planner.module';
import { SrsModule } from 'src/modules/srs/srs.module';
import { UsersModule } from 'src/modules/users/users.module';

import { AdminMetricsController } from './controllers/admin-metrics.controller';
import { ProgressController } from './controllers/progress.controller';
import { ProgressProcessor } from './jobs/progress.processor';
import { ProgressScheduler } from './jobs/progress.scheduler';
import { AdminMetricsService } from './services/admin-metrics.service';
import { AggregationService } from './services/aggregation.service';
import { StudentProgressService } from './services/student-progress.service';

/**
 * Módulo 14 — progress.
 *
 * Painel do aluno (`GET /me/progress`) e métricas do admin
 * (`GET /admin/metrics`), os dois em cima de tabelas diárias que o job
 * noturno preenche lendo os serviços dos outros módulos.
 *
 * Dono de `user_daily_activities`, `daily_platform_metrics`,
 * `lesson_daily_metrics`, `ai_cost_daily_metrics`, `plan_daily_metrics` e
 * `cohort_retention` — tudo derivado, reprocessável a qualquer momento.
 */
@Module({
  imports: [
    AiModule,
    AssessmentModule,
    BillingModule,
    CurriculumModule,
    LearnerModelModule,
    LearningModule,
    PlannerModule,
    SrsModule,
    UsersModule,
    registerQueue(QUEUES.PROGRESS),
  ],
  controllers: [ProgressController, AdminMetricsController],
  providers: [
    AggregationService,
    StudentProgressService,
    AdminMetricsService,
    ProgressProcessor,
    ProgressScheduler,
  ],
})
export class ProgressModule {}
