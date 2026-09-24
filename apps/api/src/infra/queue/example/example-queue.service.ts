import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../queues';
import type { ExampleJobData } from './example.processor';

@Injectable()
export class ExampleQueueService {
  constructor(
    @InjectQueue(QUEUES.EXAMPLE)
    private readonly queue: Queue<ExampleJobData>,
  ) {}

  /** Enfileira um job e devolve o id — o padrão de todo trabalho pesado. */
  async enqueue(message: string): Promise<{ jobId: string }> {
    const job = await this.queue.add('example', { message });

    return { jobId: job.id ?? 'unknown' };
  }

  async countJobs(): Promise<Record<string, number>> {
    return this.queue.getJobCounts();
  }
}
