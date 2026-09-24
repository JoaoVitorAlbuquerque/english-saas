import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import { QaService, QA_RUN_JOB, type QaJobData } from '../services/qa.service';

/** Checagem automática do rascunho. Tier `fast`: é leitura de texto curto. */
@Processor(QUEUES.CONTENT_QA, defaultWorkerOptions())
export class ContentQaProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentQaProcessor.name);

  constructor(private readonly qa: QaService) {
    super();
  }

  async process(job: Job<QaJobData>): Promise<unknown> {
    if (job.name !== QA_RUN_JOB) {
      this.logger.warn({ jobName: job.name }, 'Job desconhecido na fila de QA');
      return { skipped: true };
    }

    await this.qa.run(job.data);

    return { ok: true };
  }
}
