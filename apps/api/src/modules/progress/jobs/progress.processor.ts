import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import { addDays } from '../domain/dates';
import { AggregationService } from '../services/aggregation.service';
import {
  AGGREGATE_DAILY_JOB,
  AGGREGATE_RANGE_JOB,
  type AggregateRangeJobData,
} from './progress-jobs';

/**
 * Agregação do progresso. A noite reprocessa **anteontem e ontem**: às
 * 04:00 UTC o "ontem" de quem está a oeste do fuso das métricas pode ainda
 * não ter fechado, e refazer um dia é barato e idempotente.
 */
@Processor(QUEUES.PROGRESS, defaultWorkerOptions())
export class ProgressProcessor extends WorkerHost {
  constructor(private readonly aggregation: AggregationService) {
    super();
  }

  async process(job: Job<Partial<AggregateRangeJobData>>): Promise<unknown> {
    if (job.name === AGGREGATE_DAILY_JOB) {
      const yesterday = addDays(this.aggregation.today(), -1);
      await this.aggregation.aggregateRange(addDays(yesterday, -1), yesterday);
      return { done: true };
    }

    if (
      job.name === AGGREGATE_RANGE_JOB &&
      job.data.from !== undefined &&
      job.data.to !== undefined
    ) {
      await this.aggregation.aggregateRange(job.data.from, job.data.to);
      return { done: true };
    }

    return { skipped: true };
  }
}
