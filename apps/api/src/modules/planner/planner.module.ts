import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AssessmentModule } from 'src/modules/assessment/assessment.module';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { LearnerModelModule } from 'src/modules/learner-model/learner-model.module';
import { SrsModule } from 'src/modules/srs/srs.module';
import { UsersModule } from 'src/modules/users/users.module';

import { AgendaController } from './controllers/agenda.controller';
import { PlanController } from './controllers/plan.controller';
import { DailyAgendaScheduler } from './jobs/daily-agenda.scheduler';
import { PlannerListener } from './jobs/planner.listener';
import { PlannerProcessor } from './jobs/planner.processor';
import { AgendaService } from './services/agenda.service';
import { PlanService } from './services/plan.service';

/**
 * Módulo 10 — planner.
 *
 * Cronograma automático: a trilha de lições até o nível-alvo (`StudyPlan`) e
 * a agenda do dia (`DailyAgenda`) — revisão vencida, próxima lição, prática
 * das fraquezas. Recomendação, nunca trava: o conteúdo continua todo
 * liberado, o aluno abre qualquer lição a qualquer momento.
 *
 * Escuta `lesson.completed`, `checkpoint.completed`, `placement.completed`,
 * `user.onboarded` e `profile.availability_changed` pela fila `planner`.
 */
@Module({
  imports: [
    CurriculumModule,
    LearnerModelModule,
    AssessmentModule,
    SrsModule,
    UsersModule,
    registerQueue(QUEUES.PLANNER),
  ],
  controllers: [PlanController, AgendaController],
  providers: [
    PlanService,
    AgendaService,
    PlannerListener,
    PlannerProcessor,
    DailyAgendaScheduler,
  ],
  exports: [PlanService, AgendaService],
})
export class PlannerModule {}
