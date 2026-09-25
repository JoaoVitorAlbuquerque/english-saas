import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { LearningModule } from 'src/modules/learning/learning.module';
import { UsersModule } from 'src/modules/users/users.module';

import { LearnerProfileController } from './controllers/learner-profile.controller';
import { LearnerModelListener } from './jobs/learner-model.listener';
import { LearnerUpdatesProcessor } from './jobs/learner-updates.processor';
import { LearnerInterestService } from './services/learner-interest.service';
import { LearnerProfileService } from './services/learner-profile.service';
import { LearnerUpdateService } from './services/learner-update.service';

/**
 * Módulo 7 — learner-model.
 *
 * Responde "em que nível o aluno está, o que ele domina, onde ele erra e o
 * que ele precisa agora". Todo módulo que recomenda ou gera conteúdo lê
 * daqui, pelo `LearnerProfileService.getSnapshot`.
 *
 * Dono de `learner_skill_states`, `learner_error_patterns`,
 * `learner_level_snapshots` e `learner_model_cursors`. Tudo derivado das
 * respostas do learning (6): dá para reconstruir do zero apagando o cursor.
 */
@Module({
  imports: [
    CurriculumModule,
    LearningModule,
    UsersModule,
    registerQueue(QUEUES.LEARNER_UPDATES),
  ],
  controllers: [LearnerProfileController],
  providers: [
    LearnerProfileService,
    LearnerUpdateService,
    LearnerInterestService,
    LearnerUpdatesProcessor,
    LearnerModelListener,
  ],
  exports: [LearnerProfileService, LearnerInterestService],
})
export class LearnerModelModule {}
