import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';

import { COST_ALERT_TICK_JOB, MONTHLY_GRANT_TICK_JOB } from './billing-jobs';

/**
 * Os dois crons do billing. O crédito mensal é por mês calendário em UTC —
 * não é hora local que importa, é o ciclo (o plano pago também recebe na
 * confirmação do pagamento, pelo webhook).
 */
@Injectable()
export class BillingScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUES.BILLING) private readonly queue: Queue,
    private readonly envService: EnvService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.envService.isTest) {
      return;
    }

    await this.queue.add(
      MONTHLY_GRANT_TICK_JOB,
      {},
      {
        repeat: { pattern: '5 0 1 * *', tz: 'UTC' },
        jobId: MONTHLY_GRANT_TICK_JOB,
      },
    );
    await this.queue.add(
      COST_ALERT_TICK_JOB,
      {},
      {
        repeat: { pattern: '0 9 * * *', tz: 'America/Sao_Paulo' },
        jobId: COST_ALERT_TICK_JOB,
      },
    );
  }
}
