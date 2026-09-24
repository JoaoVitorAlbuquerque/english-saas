import { Global, Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AiModule } from 'src/modules/ai/ai.module';
import { CurriculumModule } from 'src/modules/curriculum/curriculum.module';
import { ContentGate } from 'src/modules/curriculum/gates/content-gate';

import { ContentStudioController } from './controllers/content-studio.controller';
import { ContentDraftsProcessor } from './jobs/content-drafts.processor';
import { ContentListener } from './jobs/content.listener';
import { ContentQaProcessor } from './jobs/content-qa.processor';
import { MediaProcessor } from './jobs/media.processor';
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
 * `@Global` por um motivo só: o `ContentGate` é o ponto de extensão que o
 * módulo 4 injeta de forma opcional. O módulo 4 não pode importar o 5 (ordem
 * de dependência do CLAUDE.md), então o provider precisa estar visível sem
 * que ninguém o importe.
 *
 * Duas tentativas por job de rascunho, não três: cada uma é uma chamada no
 * tier `smart`, e insistir numa falha determinística só queima crédito.
 */
@Global()
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
    QaService,
    ReviewService,
    TtsService,
    WorkbookService,
    ContentDraftsProcessor,
    ContentQaProcessor,
    MediaProcessor,
    ContentListener,
    { provide: ContentGate, useClass: ContentStudioGate },
  ],
  exports: [ContentGate, QaService, TtsService, WorkbookService],
})
export class ContentStudioModule {}
