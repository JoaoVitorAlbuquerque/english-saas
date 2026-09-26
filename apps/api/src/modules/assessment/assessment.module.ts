import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { LearnerModelModule } from 'src/modules/learner-model/learner-model.module';
import { LearningModule } from 'src/modules/learning/learning.module';
import { UsersModule } from 'src/modules/users/users.module';

import { AssessmentAdminController } from './controllers/assessment-admin.controller';
import { CheckpointController } from './controllers/checkpoint.controller';
import { PlacementController } from './controllers/placement.controller';
import { AssessmentProcessor } from './jobs/assessment.processor';
import { CalibrationScheduler } from './jobs/calibration.scheduler';
import { AdaptiveItemService } from './services/adaptive-item.service';
import { AssessmentResponsesService } from './services/assessment-responses.service';
import { CalibrationService } from './services/calibration.service';
import { CheckpointService } from './services/checkpoint.service';
import { PlacementService } from './services/placement.service';

/**
 * Módulo 8 — assessment.
 *
 * Nivelamento adaptativo, checkpoints de unidade, questões niveladas para o
 * aluno e calibração semanal da dificuldade dos itens.
 *
 * As respostas continuam na tabela `answers` do learning (6) — daqui só sai
 * a ligação resposta → teste. Dono de `placement_tests`, `unit_checkpoints`,
 * `assessment_responses` e `item_calibrations`.
 *
 * `AdaptiveItemService` é exportado: o SRS (9), o planner (10) e o
 * generator (13) escolhem questão por ele.
 */
@Module({
  imports: [
    CurriculumModule,
    LearningModule,
    LearnerModelModule,
    UsersModule,
    registerQueue(QUEUES.ASSESSMENT),
  ],
  controllers: [
    PlacementController,
    CheckpointController,
    AssessmentAdminController,
  ],
  providers: [
    PlacementService,
    CheckpointService,
    AdaptiveItemService,
    CalibrationService,
    AssessmentResponsesService,
    AssessmentProcessor,
    CalibrationScheduler,
  ],
  exports: [AdaptiveItemService, PlacementService, CalibrationService],
})
export class AssessmentModule {}
