import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { UsersModule } from 'src/modules/users/users.module';

import { HistoryController } from './controllers/history.controller';
import { LessonPlayerController } from './controllers/lesson-player.controller';
import { StatsController } from './controllers/stats.controller';
import { LearningListener } from './jobs/learning.listener';
import { LearningProcessor } from './jobs/learning.processor';
import { AnswerService } from './services/answer.service';
import { AttemptService } from './services/attempt.service';
import { ItemStatsService } from './services/item-stats.service';
import { LearningActivityService } from './services/learning-activity.service';
import { LearningStatsService } from './services/learning-stats.service';

/**
 * Módulo 6 — learning.
 *
 * Registra tudo o que o aluno faz: tentativas de lição, etapas concluídas,
 * respostas corrigidas, XP e sequência. É a **fonte de dados do modelo do
 * aluno** — o learner-model (7) e o SRS (9) escutam os eventos daqui e,
 * quando precisarem ler, leem pelos serviços exportados.
 *
 * Dono das tabelas `lesson_attempts`, `step_progress`, `answers` e
 * `learning_stats`.
 */
@Module({
  imports: [CurriculumModule, UsersModule, registerQueue(QUEUES.LEARNING)],
  controllers: [LessonPlayerController, HistoryController, StatsController],
  providers: [
    AttemptService,
    AnswerService,
    LearningStatsService,
    ItemStatsService,
    LearningActivityService,
    LearningProcessor,
    LearningListener,
  ],
  exports: [
    AnswerService,
    AttemptService,
    LearningStatsService,
    LearningActivityService,
  ],
})
export class LearningModule {}
