import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';

import { ANONYMIZE_SWEEP_JOB } from './users.processor';

/**
 * Agenda a varredura diária de anonimização.
 *
 * Registrada na subida, com `jobId` fixo: reiniciar a API não cria um
 * segundo agendamento.
 */
@Injectable()
export class AnonymizationScheduler implements OnModuleInit {
  private readonly logger = new Logger(AnonymizationScheduler.name);

  constructor(
    @InjectQueue(QUEUES.USERS) private readonly queue: Queue,
    private readonly envService: EnvService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Em teste o agendamento só atrapalharia: o e2e chama o serviço direto.
    if (this.envService.isTest) {
      return;
    }

    await this.queue.add(
      ANONYMIZE_SWEEP_JOB,
      {},
      {
        // Todo dia às 03:15.
        repeat: { pattern: '15 3 * * *' },
        jobId: `${ANONYMIZE_SWEEP_JOB}-daily`,
      },
    );

    this.logger.log('Varredura de anonimização agendada para 03:15 diárias');
  }
}
