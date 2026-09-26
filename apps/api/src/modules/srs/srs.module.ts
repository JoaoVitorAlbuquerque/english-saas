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
 * Dono da tabela `review_cards`. Escuta `lesson.completed` e
 * `answer.submitted` do learning (6) pela fila `scheduling`.
 *
 * `ReviewCardService` é exportado: o planner (10) conta cards vencidos pra
 * montar o bloco de revisão da agenda do dia. `StudyTermService` também: o
 * generator (13) grava o vocabulário do material como termo do aluno.
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
    ReviewSessionService,
    ReviewAnswerService,
    SrsUpdateService,
    StudyTermService,
    SrsListener,
    SrsUpdatesProcessor,
  ],
  exports: [ReviewCardService, StudyTermService],
})
export class SrsModule {}
