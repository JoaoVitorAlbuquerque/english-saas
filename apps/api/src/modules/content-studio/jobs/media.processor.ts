import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import {
  TTS_GENERATE_JOB,
  TTS_REGENERATE_JOB,
  TtsService,
} from '../services/tts.service';
import {
  WORKBOOK_PDF_JOB,
  WorkbookService,
} from '../services/workbook.service';

type MediaJobData = {
  lessonVersionId?: string;
  unitId?: string;
  keys?: string[];
  speakingRate?: number;
};

/**
 * Produção de mídia: narração e apostila.
 *
 * As duas são caras e lentas, e nenhuma pode segurar um request. A narração
 * roda na aprovação; a apostila, depois da publicação.
 */
@Processor(QUEUES.MEDIA, defaultWorkerOptions({ concurrency: 2 }))
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly tts: TtsService,
    private readonly workbooks: WorkbookService,
  ) {
    super();
  }

  async process(job: Job<MediaJobData>): Promise<unknown> {
    switch (job.name) {
      case TTS_GENERATE_JOB: {
        const { lessonVersionId } = job.data;

        if (lessonVersionId === undefined) {
          return { skipped: true };
        }

        return this.tts.generateForVersion(lessonVersionId);
      }

      case TTS_REGENERATE_JOB: {
        const { lessonVersionId, keys, speakingRate } = job.data;

        if (lessonVersionId === undefined || keys === undefined) {
          return { skipped: true };
        }

        return this.tts.regenerateForVersion(
          lessonVersionId,
          keys,
          speakingRate,
        );
      }

      case WORKBOOK_PDF_JOB: {
        const { unitId } = job.data;

        if (unitId === undefined) {
          return { skipped: true };
        }

        return this.workbooks.generateForUnit(unitId);
      }

      default:
        this.logger.warn(
          { jobName: job.name },
          'Job desconhecido na fila de mídia',
        );
        return { skipped: true };
    }
  }
}
