import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SubscriptionStatus,
  type BillingPeriod,
  type PaymentMethod,
  type PlanTier,
  type Subscription,
} from '@prisma/client';
import { Queue } from 'bullmq';

import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  AlreadySubscribedError,
  NoActiveSubscriptionError,
  PaymentGatewayError,
  PaymentUnavailableError,
} from '../billing.errors';
import { isUpgrade, upgradeCreditCents } from '../domain/proration';
import { creditCycleKey } from '../domain/credits';
import { priceLabel } from '../domain/pricing';
import {
  accessUntil,
  applyPaymentEvent,
  grantsAccess,
  subscriptionMessage,
  TIER_LABELS,
  type PaymentEventKind,
} from '../domain/subscription-state';
import {
  CANCEL_AT_GATEWAY_JOB,
  CREATE_CHECKOUT_JOB,
  type CancelAtGatewayJobData,
  type CreateCheckoutJobData,
  type ProcessWebhookJobData,
} from '../jobs/billing-jobs';
import { AiCreditService } from './ai-credit.service';
import { EntitlementsService } from './entitlements.service';
import { PaymentGateway } from './payment-gateway';
import { PlansService } from './plans.service';

const OPEN_STATUSES = [
  SubscriptionStatus.PENDING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

export type CheckoutInput = {
  tier: PlanTier;
  billingPeriod: BillingPeriod;
  paymentMethod: PaymentMethod;
  cpfCnpj?: string | undefined;
};

export type SubscriptionOverview = {
  /** O plano que vale agora — é o que libera ou não as features. */
  tier: PlanTier;
  message: string;
  subscription: {
    id: string;
    tier: PlanTier;
    billingPeriod: BillingPeriod;
    status: SubscriptionStatus;
    priceCents: number;
    priceLabel: string;
    paymentMethod: PaymentMethod;
    checkoutUrl: string | null;
    currentPeriodEnd: Date | null;
    accessUntil: Date | null;
    canceledAt: Date | null;
  } | null;
};

export type WebhookOutcome =
  | { status: 'DUPLICATE' | 'IGNORED' }
  | {
      status: 'APPLIED';
      subscriptionStatus: SubscriptionStatus;
      granted: number | null;
    };

/**
 * Ciclo de vida da assinatura: checkout, webhook do gateway e cancelamento.
 *
 * Toda chamada ao gateway roda em job (fila `billing`) — o request só grava
 * a intenção e responde. Cancelar é um clique: vale aqui na hora, e o job
 * cuida de parar a cobrança no Asaas, com retry.
 */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly credits: AiCreditService,
    private readonly entitlements: EntitlementsService,
    private readonly gateway: PaymentGateway,
    private readonly users: UsersService,
    private readonly events: EventBusService,
    @InjectQueue(QUEUES.BILLING) private readonly queue: Queue,
  ) {}

  async overview(
    userId: string,
    now = new Date(),
  ): Promise<SubscriptionOverview> {
    const subs = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const shown =
      subs.find((sub) =>
        OPEN_STATUSES.some((status) => status === sub.status),
      ) ??
      subs.find((sub) => grantsAccess(sub, now)) ??
      subs[0] ??
      null;
    const { tier } = await this.entitlements.currentPlan(userId, now);

    return {
      tier,
      message: subscriptionMessage(shown, now),
      subscription:
        shown === null
          ? null
          : {
              id: shown.id,
              tier: shown.tier,
              billingPeriod: shown.billingPeriod,
              status: shown.status,
              priceCents: shown.priceCents,
              priceLabel: priceLabel(shown.priceCents, shown.billingPeriod),
              paymentMethod: shown.paymentMethod,
              checkoutUrl: shown.checkoutUrl,
              currentPeriodEnd: shown.currentPeriodEnd,
              accessUntil: accessUntil(shown, now),
              canceledAt: shown.canceledAt,
            },
    };
  }

  /**
   * Abre a assinatura em PENDING e enfileira a criação no gateway. O link
   * de pagamento aparece em `GET /me/subscription` quando o job terminar.
   */
  async checkout(
    userId: string,
    input: CheckoutInput,
  ): Promise<SubscriptionOverview> {
    const now = new Date();
    const plan = await this.plans.findPurchasable(
      input.tier,
      input.billingPeriod,
    );
    const open = await this.prisma.subscription.findMany({
      where: { userId, status: { in: OPEN_STATUSES } },
    });
    const active = open.find(
      (sub) => sub.status !== SubscriptionStatus.PENDING,
    );
    const upgrade =
      active !== undefined &&
      isUpgrade({
        currentTier: active.tier,
        currentStatus: active.status,
        targetTier: plan.tier,
      });

    // Mesmo tier, tier menor ou assinatura atrasada: não é upgrade. Troca
    // para baixo ainda não existe — cancela e assina de novo.
    if (active !== undefined && !upgrade) {
      throw new AlreadySubscribedError(active.tier);
    }

    // Checkout largado no meio: o novo substitui, e o antigo para de cobrar.
    for (const pending of open.filter(
      (sub) => sub.status === SubscriptionStatus.PENDING,
    )) {
      await this.prisma.subscription.update({
        where: { id: pending.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      await this.enqueueGatewayCancel(pending);
    }

    // O cliente do Asaas nasce aqui, no request: o CPF vai direto para o
    // gateway e nunca entra nos dados de um job (que ficam no Redis e no
    // Bull Board).
    const customerId = await this.ensureCustomer(userId, input.cpfCnpj);

    let created: Subscription;

    try {
      created = await this.prisma.subscription.create({
        data: {
          userId,
          planId: plan.id,
          tier: plan.tier,
          // `findPurchasable` nunca devolve o FREE, o único sem período.
          billingPeriod: input.billingPeriod,
          priceCents: plan.priceCents,
          paymentMethod: input.paymentMethod,
          asaasCustomerId: customerId,
          ...(active !== undefined && upgrade
            ? {
                upgradesFromId: active.id,
                firstPaymentDiscountCents: upgradeCreditCents({
                  currentPriceCents: active.priceCents,
                  currentPeriod: active.billingPeriod,
                  currentPeriodEnd: active.currentPeriodEnd,
                  newPriceCents: plan.priceCents,
                  now,
                }),
              }
            : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AlreadySubscribedError(input.tier);
      }

      throw error;
    }

    const data: CreateCheckoutJobData = { subscriptionId: created.id };
    await this.queue.add(CREATE_CHECKOUT_JOB, data, {
      jobId: `checkout-${created.id}`,
    });

    return this.overview(userId);
  }

  /**
   * Job do checkout. Cada passo grava o que conseguiu antes do próximo, então
   * o retry retoma de onde parou sem criar cliente ou assinatura em dobro.
   */
  async processCheckout(
    data: CreateCheckoutJobData,
    now = new Date(),
  ): Promise<{ status: 'READY' | 'SKIPPED' | 'ABANDONED' }> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: data.subscriptionId },
    });

    if (sub?.status !== SubscriptionStatus.PENDING) {
      return { status: 'SKIPPED' };
    }

    const customerId = sub.asaasCustomerId;

    if (customerId === null) {
      // O checkout cria o cliente antes de enfileirar; sem ele, não há o que
      // cobrar — falha para o retry e, no fim, para o `markCheckoutFailed`.
      throw new PaymentGatewayError(
        'missing_customer',
        'Assinatura sem cliente no gateway.',
      );
    }

    let gatewayId = sub.asaasSubscriptionId;

    if (gatewayId === null) {
      gatewayId = (
        await this.gateway.createSubscription({
          customerId,
          reference: sub.id,
          description: `english-saas ${TIER_LABELS[sub.tier]} (${sub.billingPeriod === 'MONTHLY' ? 'mensal' : 'anual'})`,
          priceCents: sub.priceCents,
          cycle: sub.billingPeriod,
          paymentMethod: sub.paymentMethod,
          // Upgrade cobra já, com o desconto: o plano novo vale ao pagar.
          firstDueDate:
            sub.upgradesFromId === null
              ? await this.firstDueDate(sub.userId, now)
              : now,
          firstPaymentDiscountCents: sub.firstPaymentDiscountCents,
        })
      ).id;
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { asaasSubscriptionId: gatewayId },
      });
    }

    // O aluno pode ter cancelado enquanto o gateway respondia.
    const fresh = await this.prisma.subscription.findUnique({
      where: { id: sub.id },
      select: { status: true },
    });

    if (fresh?.status !== SubscriptionStatus.PENDING) {
      await this.gateway.cancelSubscription(gatewayId);
      return { status: 'ABANDONED' };
    }

    const checkoutUrl = await this.gateway.getCheckoutUrl(gatewayId);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { checkoutUrl },
    });

    return { status: 'READY' };
  }

  /** O checkout desistiu depois de todas as tentativas. */
  async markCheckoutFailed(subscriptionId: string): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { id: subscriptionId, status: SubscriptionStatus.PENDING },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  }

  /**
   * Um clique, sem pergunta: vale na hora. O acesso segue até o fim do que
   * já foi pago; a cobrança para no gateway pelo job.
   */
  async cancel(
    userId: string,
    now = new Date(),
  ): Promise<SubscriptionOverview> {
    // Tudo o que está em aberto: a assinatura em uso e um upgrade pendente.
    const open = await this.prisma.subscription.findMany({
      where: { userId, status: { in: OPEN_STATUSES } },
    });

    if (open.length === 0) {
      throw new NoActiveSubscriptionError();
    }

    for (const sub of open) {
      const canceled = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.CANCELED, canceledAt: now },
      });
      await this.enqueueGatewayCancel(sub);

      this.events.emit(
        'subscription.canceled',
        {
          subscriptionId: canceled.id,
          tier: canceled.tier,
          accessUntil: accessUntil(canceled, now)?.toISOString() ?? null,
        },
        { userId },
      );
    }

    await this.entitlements.invalidate(userId);

    return this.overview(userId, now);
  }

  async cancelAtGateway(data: CancelAtGatewayJobData): Promise<void> {
    await this.gateway.cancelSubscription(data.asaasSubscriptionId);
  }

  /**
   * Aplica um webhook. A linha em `asaas_webhook_events` entra na mesma
   * transação do efeito: reentregar o mesmo evento não faz nada, nem se
   * duas entregas chegarem ao mesmo tempo (a segunda bate no unique).
   */
  async applyWebhook(
    event: ProcessWebhookJobData,
    now = new Date(),
  ): Promise<WebhookOutcome> {
    let result:
      | WebhookOutcome
      | {
          status: 'APPLIED_INTERNAL';
          before: Subscription;
          after: Subscription;
          replaced: Subscription | null;
          granted: number | null;
          activated: boolean;
          paymentFailed: boolean;
          expired: boolean;
        };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const seen = await tx.asaasWebhookEvent.findUnique({
          where: { externalEventId: event.externalEventId },
          select: { id: true },
        });

        if (seen !== null) {
          return { status: 'DUPLICATE' as const };
        }

        await tx.asaasWebhookEvent.create({
          data: {
            externalEventId: event.externalEventId,
            eventType: event.rawType,
            payload: (event.payload ?? {}) as Prisma.InputJsonValue,
          },
        });

        if (event.kind === null || event.externalSubscriptionId === null) {
          return { status: 'IGNORED' as const };
        }

        const sub = await tx.subscription.findUnique({
          where: { asaasSubscriptionId: event.externalSubscriptionId },
          include: { plan: { select: { monthlyAiCredits: true } } },
        });

        if (sub === null) {
          return { status: 'IGNORED' as const };
        }

        const transition = applyPaymentEvent(sub, {
          kind: event.kind as PaymentEventKind,
          paymentDueDate:
            event.paymentDueDate === null
              ? null
              : new Date(event.paymentDueDate),
        });
        // Upgrade pago: o plano anterior sai antes — os dias que sobravam
        // já viraram desconto na primeira cobrança deste. A ordem importa:
        // só pode haver uma assinatura ACTIVE por aluno (índice parcial).
        const replaced =
          transition.activated && sub.upgradesFromId !== null
            ? await tx.subscription.update({
                where: { id: sub.upgradesFromId },
                data: {
                  status: SubscriptionStatus.CANCELED,
                  canceledAt: now,
                  currentPeriodEnd: now,
                },
              })
            : null;

        const after = await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: transition.status,
            currentPeriodEnd: transition.currentPeriodEnd,
          },
        });

        let granted: number | null = null;

        if (event.kind === 'PAYMENT_PAID' && grantsAccess(after, now)) {
          const grant = await this.credits.grantCycle(
            {
              userId: sub.userId,
              tier: sub.tier,
              monthlyCredits: sub.plan.monthlyAiCredits,
              cycleKey: creditCycleKey(sub.tier, now),
            },
            tx,
          );
          granted = grant?.amount ?? null;
        }

        return {
          status: 'APPLIED_INTERNAL' as const,
          before: sub,
          after,
          replaced,
          granted,
          activated: transition.activated,
          paymentFailed: transition.paymentFailed,
          expired: transition.expired,
        };
      });
    } catch (error) {
      // Só a duplicidade do próprio evento é "já processado". Outra violação
      // de unique (ex.: duas assinaturas ativas) é bug e tem de aparecer.
      if (isUniqueViolation(error, 'external_event_id')) {
        return { status: 'DUPLICATE' };
      }

      throw error;
    }

    if (result.status !== 'APPLIED_INTERNAL') {
      return result;
    }

    await this.entitlements.invalidate(result.after.userId);

    if (result.replaced !== null) {
      await this.enqueueGatewayCancel(result.replaced);
      this.events.emit(
        'subscription.canceled',
        {
          subscriptionId: result.replaced.id,
          tier: result.replaced.tier,
          accessUntil: null,
        },
        { userId: result.replaced.userId },
      );
    }

    this.emitTransition(result);

    return {
      status: 'APPLIED',
      subscriptionStatus: result.after.status,
      granted: result.granted,
    };
  }

  /** Crédito do mês pelo plano que vale agora. `null` = já recebeu. */
  async grantMonthly(
    userId: string,
    now = new Date(),
  ): Promise<{ amount: number } | null> {
    const plan = await this.entitlements.currentPlan(userId, now);

    return this.credits.grantCycle({
      userId,
      tier: plan.tier,
      monthlyCredits: plan.monthlyAiCredits,
      cycleKey: creditCycleKey(plan.tier, now),
    });
  }

  /** Conta excluída não pode continuar sendo cobrada. */
  async cancelForDeletedAccount(userId: string): Promise<void> {
    try {
      await this.cancel(userId);
    } catch (error) {
      if (!(error instanceof NoActiveSubscriptionError)) {
        throw error;
      }
    }
  }

  private emitTransition(result: {
    after: Subscription;
    activated: boolean;
    paymentFailed: boolean;
    expired: boolean;
  }): void {
    const { after } = result;
    const options = { userId: after.userId };

    if (result.activated) {
      this.events.emit(
        'subscription.activated',
        {
          subscriptionId: after.id,
          tier: after.tier,
          billingPeriod: after.billingPeriod,
          currentPeriodEnd: after.currentPeriodEnd?.toISOString() ?? null,
        },
        options,
      );
    }

    if (result.paymentFailed) {
      this.events.emit(
        'subscription.payment_failed',
        { subscriptionId: after.id, tier: after.tier },
        options,
      );
    }

    if (result.expired) {
      this.events.emit(
        'subscription.expired',
        { subscriptionId: after.id, tier: after.tier },
        options,
      );
    }
  }

  private async enqueueGatewayCancel(sub: Subscription): Promise<void> {
    if (sub.asaasSubscriptionId === null) {
      // Ainda não chegou no gateway; o job de checkout vê o status e desiste.
      return;
    }

    const data: CancelAtGatewayJobData = {
      asaasSubscriptionId: sub.asaasSubscriptionId,
    };
    await this.queue.add(CANCEL_AT_GATEWAY_JOB, data, {
      jobId: `cancel-${sub.id}`,
    });
  }

  /** Reaproveita o cliente de uma assinatura anterior; senão cria agora. */
  private async ensureCustomer(
    userId: string,
    cpfCnpj: string | undefined,
  ): Promise<string> {
    const previous = await this.prisma.subscription.findFirst({
      where: { userId, asaasCustomerId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { asaasCustomerId: true },
    });

    if (previous?.asaasCustomerId != null) {
      return previous.asaasCustomerId;
    }

    const user = await this.users.findById(userId);

    try {
      return (
        await this.gateway.createCustomer({
          userId,
          name: user.name,
          email: user.email,
          cpfCnpj,
        })
      ).id;
    } catch (error) {
      if (error instanceof PaymentGatewayError) {
        throw new PaymentUnavailableError();
      }

      throw error;
    }
  }

  /**
   * Hoje — ou, se ainda há um plano cancelado dentro do período pago, o fim
   * dele: assinar de novo não faz o aluno pagar duas vezes pelos mesmos dias.
   */
  private async firstDueDate(userId: string, now: Date): Promise<Date> {
    const canceled = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: SubscriptionStatus.CANCELED,
        currentPeriodEnd: { gt: now },
      },
      select: { currentPeriodEnd: true },
    });
    const latest = canceled.reduce(
      (max, sub) =>
        sub.currentPeriodEnd !== null && sub.currentPeriodEnd.getTime() > max
          ? sub.currentPeriodEnd.getTime()
          : max,
      now.getTime(),
    );

    return new Date(latest);
  }
}

/** P2002; com `column`, só quando o unique violado envolve essa coluna. */
function isUniqueViolation(error: unknown, column?: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  if (column === undefined) {
    return true;
  }

  const target = JSON.stringify(error.meta?.['target'] ?? '');
  const camel = column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

  return target.includes(column) || target.includes(camel);
}
