import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';

import { AGGREGATE_DAILY_JOB } from './progress-jobs';

/**
 * Agenda a agregação noturna. `jobId` fixo: reiniciar a API não cria um
 * segundo agendamento. Em teste não agenda — o e2e chama o serviço direto.
 */
@Injectable()
export class ProgressScheduler implements OnModuleInit {
  private readonly logger = new Logger(ProgressScheduler.name);

  constructor(
    @InjectQueue(QUEUES.PROGRESS) private readonly queue: Queue,
    private readonly envService: EnvService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.envService.isTest) {
      return;
    }

    await this.queue.add(
      AGGREGATE_DAILY_JOB,
      {},
      {
        // 04:00 UTC = 01:00 em Brasília: o dia de quase todo aluno já fechou.
        repeat: { pattern: '0 4 * * *', tz: 'UTC' },
        jobId: `${AGGREGATE_DAILY_JOB}-nightly`,
      },
    );

    this.logger.log('Agregação do progresso agendada para 04:00 UTC');
  }
}
