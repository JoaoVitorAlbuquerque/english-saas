import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { AppException } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import { DraftGeneratorService } from '../services/draft-generator.service';
import {
  DRAFT_ITEMS_JOB,
  DRAFT_LESSON_JOB,
  DRAFT_REGISTER_NOTES_JOB,
} from '../services/draft.service';

type DraftJobData = { draftId: string };

/**
 * Geração de rascunho pela IA.
 *
 * Concorrência baixa de propósito: cada job é uma chamada no tier `smart`,
 * cara e demorada. Deixar cinco rodando em paralelo só serviria para
 * estourar o rate limit do provedor e a fatura junto.
 */
@Processor(QUEUES.CONTENT_DRAFTS, defaultWorkerOptions({ concurrency: 2 }))
export class ContentDraftsProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentDraftsProcessor.name);

  constructor(
    private readonly generator: DraftGeneratorService,
    private readonly events: EventBusService,
  ) {
    super();
  }

  async process(job: Job<DraftJobData>): Promise<unknown> {
    const { draftId } = job.data;

    try {
      switch (job.name) {
        case DRAFT_LESSON_JOB:
          await this.generator.generateLesson(draftId);
          break;

        case DRAFT_ITEMS_JOB:
          await this.generator.generateItems(draftId);
          break;

        case DRAFT_REGISTER_NOTES_JOB:
          await this.generator.generateRegisterNotes(draftId);
          break;

        default:
          this.logger.warn({ jobName: job.name }, 'Job desconhecido');
          return { skipped: true };
      }

      return { draftId, ok: true };
    } catch (error) {
      const errorCode =
        error instanceof AppException
          ? error.code
          : error instanceof Error
            ? error.name
            : 'UNKNOWN';

      // O rascunho fica em FAILED com o código. Se o BullMQ ainda tiver
      // tentativa, a próxima volta ele para GENERATING.
      await this.generator.fail(draftId, errorCode);

      this.events.emit('content.draft_failed', {
        draftId,
        kind: job.name,
        errorCode,
      });

      this.logger.warn(
        { draftId, jobName: job.name, errorCode },
        'Geração de rascunho falhou',
      );

      throw error;
    }
  }
}
