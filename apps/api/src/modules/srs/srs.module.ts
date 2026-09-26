import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AssessmentModule } from 'src/modules/assessment/assessment.module';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { LearningModule } from 'src/modules/learning/learning.module';

import { ReviewsController } from './controllers/reviews.controller';
import { SrsUpdatesProcessor } from './jobs/srs-updates.processor';
import { SrsListener } from './jobs/srs.listener';
import { ReviewAnswerService } from './services/review-answer.service';
import { ReviewCardService } from './services/review-card.service';
import { ReviewLogService } from './services/review-log.service';
import { ReviewSessionService } from './services/review-session.service';
import { SrsUpdateService } from './services/srs-update.service';
import { StudyTermService } from './services/study-term.service';

/**
 * Módulo 9 — srs.
 *
 * Revisão espaçada com FSRS (`ts-fsrs`): um `ReviewCard` por skill, chunk,
 * vocabulário, nota de registro ou padrão de erro que a lição toca. Skill
 * usa uma questão nivelada do assessment (8); os demais viram um flashcard
 * simples, auto-avaliado pelo aluno.
 *
 * Dono das tabelas `review_cards`, `review_logs` e `study_terms`. Escuta
 * `lesson.completed` e `answer.submitted` do learning (6) pela fila
 * `scheduling`.
 *
 * `ReviewCardService` é exportado: o planner (10) conta cards vencidos pra
 * montar o bloco de revisão da agenda do dia. `StudyTermService` também: o
 * generator (13) grava o vocabulário do material como termo do aluno. E o
 * `ReviewLogService`: o progresso (14) conta as revisões feitas por dia.
 */
@Module({
  imports: [
    CurriculumModule,
    LearningModule,
    AssessmentModule,
    registerQueue(QUEUES.SCHEDULING),
  ],
  controllers: [ReviewsController],
  providers: [
    ReviewCardService,
    ReviewLogService,
    ReviewSessionService,
    ReviewAnswerService,
    SrsUpdateService,
    StudyTermService,
    SrsListener,
    SrsUpdatesProcessor,
  ],
  exports: [ReviewCardService, ReviewLogService, StudyTermService],
})
export class SrsModule {}
