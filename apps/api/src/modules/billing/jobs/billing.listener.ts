import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { EntitlementsService } from '../services/entitlements.service';
import { SubscriptionService } from '../services/subscription.service';
import { GRANT_CREDITS_JOB, type GrantCreditsJobData } from './billing-jobs';

/**
 * Conta nova recebe o crédito do FREE do mês na hora (o cron só roda no
 * dia 1º). Conta excluída tem a assinatura cancelada — não pode continuar
 * sendo cobrada. Qualquer mudança de assinatura derruba o plano em cache.
 */
@Injectable()
export class BillingListener {
  constructor(
    @InjectQueue(QUEUES.BILLING) private readonly queue: Queue,
    private readonly subscriptions: SubscriptionService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @OnEvent([
    'subscription.activated',
    'subscription.canceled',
    'subscription.expired',
    'subscription.payment_failed',
  ])
  async onSubscriptionChanged(event: DomainEvent): Promise<void> {
    if (event.userId !== undefined) {
      await this.entitlements.invalidate(event.userId);
    }
  }

  @OnEvent('user.registered')
  async onUserRegistered(event: DomainEvent<'user.registered'>): Promise<void> {
    const data: GrantCreditsJobData = { userId: event.payload.userId };

    await this.queue.add(GRANT_CREDITS_JOB, data, {
      jobId: `grant-${data.userId}-${event.occurredAt.toISOString().slice(0, 7)}`,
    });
  }

  @OnEvent('user.deletion_requested')
  async onDeletionRequested(
    event: DomainEvent<'user.deletion_requested'>,
  ): Promise<void> {
    await this.subscriptions.cancelForDeletedAccount(event.payload.userId);
  }
}
