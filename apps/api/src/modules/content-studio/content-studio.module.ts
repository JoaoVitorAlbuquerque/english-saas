import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AiModule } from 'src/modules/ai/ai.module';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';

import { ContentStudioController } from './controllers/content-studio.controller';
import { ContentDraftsProcessor } from './jobs/content-drafts.processor';
import { ContentListener } from './jobs/content.listener';
import { ContentQaProcessor } from './jobs/content-qa.processor';
import { MediaProcessor } from './jobs/media.processor';
import { AudioReviewService } from './services/audio-review.service';
import { ContentStudioGate } from './services/content-gate.service';
import { DraftGeneratorService } from './services/draft-generator.service';
import { DraftService } from './services/draft.service';
import { QaService } from './services/qa.service';
import { ReviewService } from './services/review.service';
import { TtsService } from './services/tts.service';
import { WorkbookService } from './services/workbook.service';

/**
 * Módulo 5 — content-studio.
 *
 * O editor pede, a IA rascunha, a QA confere e **um humano aprova**. Nada
 * gerado aqui chega ao aluno sem esse aprovar.
 *
 * O `ContentStudioGate` implementa a trava editorial (`CONTENT_GATE`) que
 * o módulo 4 injeta; a ligação é feita no AppModule, pelo `AccessModule` —
 * o módulo 4 não pode importar o 5.
 *
 * Duas tentativas por job de rascunho, não três: cada uma é uma chamada no
 * tier `smart`, e insistir numa falha determinística só queima crédito.
 */
@Module({
  imports: [
    CurriculumModule,
    AiModule,
    registerQueue(QUEUES.CONTENT_DRAFTS, { attempts: 2 }),
    registerQueue(QUEUES.CONTENT_QA),
    registerQueue(QUEUES.MEDIA),
  ],
  controllers: [ContentStudioController],
  providers: [
    DraftService,
    DraftGeneratorService,
    AudioReviewService,
    QaService,
    ReviewService,
    TtsService,
    WorkbookService,
    ContentDraftsProcessor,
    ContentQaProcessor,
    MediaProcessor,
    ContentListener,
    ContentStudioGate,
  ],
  exports: [ContentStudioGate, QaService, TtsService, WorkbookService],
})
export class ContentStudioModule {}
