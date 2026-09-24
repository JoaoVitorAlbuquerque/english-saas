import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { EventBusService } from 'src/infra/events/event-bus.service';

import { QUEUES } from '../queues';
import { defaultWorkerOptions } from '../register-queue';

export type ExampleJobData = {
  message: string;
};

export type ExampleJobResult = {
  processedAt: string;
  echo: string;
};

/**
 * Processor de demonstração da infraestrutura: prova o caminho
 * enfileirar → processar → aparecer no Bull Board → emitir evento.
 *
 * Sai daqui assim que existir uma fila de verdade (módulo 2 em diante).
 */
@Processor(QUEUES.EXAMPLE, defaultWorkerOptions())
export class ExampleProcessor extends WorkerHost {
  private readonly logger = new Logger(ExampleProcessor.name);

  constructor(private readonly eventBus: EventBusService) {
    super();
  }

  async process(job: Job<ExampleJobData>): Promise<ExampleJobResult> {
    const processedAt = new Date().toISOString();

    this.logger.log(
      { jobId: job.id, queue: job.queueName },
      'Job de exemplo processado',
    );

    this.eventBus.emit('infra.example_job.processed', {
      jobId: job.id ?? 'unknown',
      message: job.data.message,
      processedAt,
    });

    return await Promise.resolve({ processedAt, echo: job.data.message });
  }
}
