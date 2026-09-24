import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import {
  ITEM_STATS_JOB,
  ItemStatsService,
} from '../services/item-stats.service';

type ItemStatsJobData = { itemId: string };

/** Trabalho em lote sobre as respostas. Nada aqui segura request. */
@Processor(QUEUES.LEARNING, defaultWorkerOptions())
export class LearningProcessor extends WorkerHost {
  private readonly logger = new Logger(LearningProcessor.name);

  constructor(private readonly itemStats: ItemStatsService) {
    super();
  }

  async process(job: Job<ItemStatsJobData>): Promise<unknown> {
    if (job.name === ITEM_STATS_JOB) {
      return this.itemStats.recompute(job.data.itemId);
    }

    this.logger.warn(
      { jobName: job.name },
      'Job desconhecido na fila learning',
    );
    return { skipped: true };
  }
}
