import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AiModule } from 'src/modules/ai/ai.module';
import { BillingModule } from 'src/modules/billing/billing.module';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { LearnerModelModule } from 'src/modules/learner-model/learner-model.module';

import { TutorController } from './controllers/tutor.controller';
import { TutorProcessor } from './jobs/tutor.processor';
import { CorrectionService } from './services/correction.service';
import { RoleplayService } from './services/roleplay.service';
import { FakeSpeechToText, SpeechToText } from './services/speech-to-text';
import { VoiceGate } from './services/voice-gate';

/**
 * Módulo 12 — tutor.
 *
 * Correção de produção livre (tier smart) e roleplay (tier fast), pagos em
 * créditos do billing (11), lendo o modelo do aluno (7) e o catálogo (4).
 * O resultado vira `tutor.feedback`, que o learner-model (7) e o SRS (9)
 * escutam — o tutor não escreve nas tabelas deles.
 *
 * A voz está pronta atrás de `TUTOR_VOICE_ENABLED` (desligada): só existe
 * o STT fake.
 */
@Module({
  imports: [
    AiModule,
    BillingModule,
    CurriculumModule,
    LearnerModelModule,
    // Uma tentativa a menos que o padrão: cada uma é uma chamada de IA.
    registerQueue(QUEUES.TUTOR, { attempts: 2 }),
  ],
  controllers: [TutorController],
  providers: [
    CorrectionService,
    RoleplayService,
    VoiceGate,
    TutorProcessor,
    // `SPEECH_TO_TEXT_PROVIDER` só aceita `fake` por enquanto.
    { provide: SpeechToText, useClass: FakeSpeechToText },
  ],
})
export class TutorModule {}
