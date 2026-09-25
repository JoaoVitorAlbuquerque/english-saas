import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue, type Job } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';
import { AiUsageService } from 'src/modules/ai/services/ai-usage.service';
import { UsersService } from 'src/modules/users/services/users.service';

import { SubscriptionService } from '../services/subscription.service';
import {
  CANCEL_AT_GATEWAY_JOB,
  COST_ALERT_TICK_JOB,
  CREATE_CHECKOUT_JOB,
  GRANT_CREDITS_JOB,
  MONTHLY_GRANT_TICK_JOB,
  PROCESS_WEBHOOK_JOB,
  type CancelAtGatewayJobData,
  type CreateCheckoutJobData,
  type GrantCreditsJobData,
  type ProcessWebhookJobData,
} from './billing-jobs';

const USERS_PAGE = 500;

@Processor(QUEUES.BILLING, defaultWorkerOptions())
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly users: UsersService,
    private readonly aiUsage: AiUsageService,
    private readonly envService: EnvService,
    @InjectQueue(QUEUES.BILLING) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case CREATE_CHECKOUT_JOB:
        return this.createCheckout(job as Job<CreateCheckoutJobData>);
      case CANCEL_AT_GATEWAY_JOB:
        await this.subscriptions.cancelAtGateway(
          job.data as CancelAtGatewayJobData,
        );
        return { done: true };
      case PROCESS_WEBHOOK_JOB:
        return this.subscriptions.applyWebhook(
          job.data as ProcessWebhookJobData,
        );
      case GRANT_CREDITS_JOB:
        return this.subscriptions.grantMonthly(
          (job.data as GrantCreditsJobData).userId,
        );
      case MONTHLY_GRANT_TICK_JOB:
        return this.monthlyGrantTick();
      case COST_ALERT_TICK_JOB:
        return this.costAlertTick();
      default:
        return { skipped: true };
    }
  }

  /** Última tentativa falhou: o checkout morre e o aluno pode tentar de novo. */
  private async createCheckout(
    job: Job<CreateCheckoutJobData>,
  ): Promise<unknown> {
    try {
      return await this.subscriptions.processCheckout(job.data);
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.subscriptions.markCheckoutFailed(job.data.subscriptionId);
      }

      throw error;
    }
  }

  /** Um job de crédito por aluno — não segura o worker passando por todo mundo. */
  private async monthlyGrantTick(
    now = new Date(),
  ): Promise<{ enqueued: number }> {
    const month = now.toISOString().slice(0, 7);
    let afterId: string | undefined;
    let enqueued = 0;

    for (;;) {
      const ids = await this.users.listActiveIds({ afterId, take: USERS_PAGE });

      if (ids.length === 0) {
        return { enqueued };
      }

      await this.queue.addBulk(
        ids.map((userId) => ({
          name: GRANT_CREDITS_JOB,
          data: { userId } satisfies GrantCreditsJobData,
          opts: { jobId: `grant-${userId}-${month}` },
        })),
      );
      enqueued += ids.length;
      afterId = ids.at(-1);
    }
  }

  /**
   * Alerta interno: aluno cujo custo real de IA no mês passou do teto. Só
   * log — quem acompanha é a gente, não o aluno.
   */
  private async costAlertTick(now = new Date()): Promise<{ alerts: number }> {
    const threshold = this.envService.get(
      'AI_USER_MONTHLY_COST_ALERT_USD_MICROS',
    );
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const totals = await this.aiUsage.totalsByUser({ from, to: now });
    const over = totals.filter((row) => row.costUsdMicros > threshold);

    for (const row of over) {
      this.logger.warn(
        {
          userId: row.userId,
          costUsdMicros: row.costUsdMicros,
          calls: row.calls,
          thresholdUsdMicros: threshold,
        },
        'Custo de IA de um aluno passou do teto do mês',
      );
    }

    return { alerts: over.length };
  }
}
