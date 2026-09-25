import { highestTier, type PlanTier } from './entitlements';
import type { BillingPeriod } from './pricing';

export type SubscriptionStatus =
  'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export type SubscriptionView = {
  tier: PlanTier;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
};

/** O que o gateway avisou, já normalizado (ver `webhook.ts`). */
export type PaymentEventKind =
  'PAYMENT_PAID' | 'PAYMENT_OVERDUE' | 'SUBSCRIPTION_ENDED';

export type SubscriptionTransition = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  /** Saiu de PENDING agora: primeiro pagamento confirmado. */
  activated: boolean;
  paymentFailed: boolean;
  expired: boolean;
};

/**
 * A assinatura dá acesso agora? PAST_DUE ainda dá (carência enquanto o
 * Asaas tenta cobrar); CANCELED dá até o fim do período pago; PENDING e
 * EXPIRED não dão.
 */
export function grantsAccess(sub: SubscriptionView, now: Date): boolean {
  if (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE') {
    return true;
  }

  return (
    sub.status === 'CANCELED' &&
    sub.currentPeriodEnd !== null &&
    now.getTime() < sub.currentPeriodEnd.getTime()
  );
}

/** O maior tier entre as assinaturas que ainda dão acesso; nenhuma → FREE. */
export function effectiveTier(
  subs: readonly SubscriptionView[],
  now: Date,
): PlanTier {
  return highestTier(
    subs.filter((sub) => grantsAccess(sub, now)).map((sub) => sub.tier),
  );
}

/**
 * Por quanto tempo o plano calculado agora pode ficar em cache. Assinatura
 * cancelada deixa de dar acesso sozinha no fim do período pago, sem evento
 * nenhum — o cache não pode passar desse instante.
 */
export function planCacheTtlSeconds(
  subs: readonly SubscriptionView[],
  now: Date,
  maxSeconds: number,
): number {
  const expiries = subs
    .filter(
      (sub) =>
        sub.status === 'CANCELED' &&
        sub.currentPeriodEnd !== null &&
        grantsAccess(sub, now),
    )
    .map((sub) => (sub.currentPeriodEnd?.getTime() ?? 0) - now.getTime());
  const untilExpiry = Math.floor(
    Math.min(...expiries, maxSeconds * 1000) / 1000,
  );

  return Math.max(1, Math.min(maxSeconds, untilExpiry));
}

export const TIER_LABELS: Record<PlanTier, string> = {
  FREE: 'Gratuito',
  BASE: 'Base',
  PLUS: 'Plus',
};

const DATE_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Até quando o aluno tem o plano desta assinatura, se tem. */
export function accessUntil(sub: SubscriptionView, now: Date): Date | null {
  return grantsAccess(sub, now) ? sub.currentPeriodEnd : null;
}

/**
 * A situação da assinatura numa frase, sem letra miúda: o que ele tem, até
 * quando, e que dá para cancelar.
 */
export function subscriptionMessage(
  sub: (SubscriptionView & { checkoutUrl: string | null }) | null,
  now: Date,
): string {
  if (sub === null) {
    return 'Você está no plano Gratuito.';
  }

  const label = TIER_LABELS[sub.tier];
  const end =
    sub.currentPeriodEnd === null ? null : DATE_BR.format(sub.currentPeriodEnd);

  switch (sub.status) {
    case 'PENDING':
      return sub.checkoutUrl === null
        ? 'Estamos preparando o seu link de pagamento. Leva só alguns segundos.'
        : `Falta só o pagamento. Assim que ele for confirmado, o plano ${label} libera.`;
    case 'ACTIVE':
      return end === null
        ? `Seu plano ${label} está ativo. Dá para cancelar quando quiser.`
        : `Seu plano ${label} renova em ${end}. Dá para cancelar quando quiser.`;
    case 'PAST_DUE':
      return 'A última cobrança não foi paga. Seu acesso continua enquanto o pagamento é refeito.';
    case 'CANCELED':
      return grantsAccess(sub, now) && end !== null
        ? `Assinatura cancelada. Você continua com o plano ${label} até ${end}, e nada mais será cobrado.`
        : 'Assinatura cancelada. Você está no plano Gratuito.';
    case 'EXPIRED':
      return 'Sua assinatura terminou. Você está no plano Gratuito.';
  }
}

/**
 * Soma um período a uma data em UTC. Mês com menos dias prende no último
 * (31/jan + 1 mês = 28 ou 29/fev), nunca transborda pro mês seguinte.
 */
export function addPeriod(
  date: Date,
  period: BillingPeriod,
  direction: 1 | -1 = 1,
): Date {
  const months = (period === 'MONTHLY' ? 1 : 12) * direction;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * Próximo estado da assinatura diante de um evento do gateway.
 *
 * - Pagamento confirmado: ACTIVE, e o período pago vai até o vencimento
 *   daquela cobrança + um ciclo (nunca volta pra trás com evento atrasado).
 *   Em assinatura já CANCELED/EXPIRED não reabre nada.
 * - Atraso: ACTIVE → PAST_DUE.
 * - Assinatura encerrada no gateway: EXPIRED, a não ser que o próprio aluno
 *   tenha cancelado antes — aí continua CANCELED, com o acesso até o fim.
 */
export function applyPaymentEvent(
  sub: SubscriptionView,
  event: { kind: PaymentEventKind; paymentDueDate: Date | null },
): SubscriptionTransition {
  const unchanged: SubscriptionTransition = {
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    activated: false,
    paymentFailed: false,
    expired: false,
  };

  if (event.kind === 'PAYMENT_PAID') {
    if (sub.status === 'CANCELED' || sub.status === 'EXPIRED') {
      return unchanged;
    }

    const paidUntil =
      event.paymentDueDate === null
        ? sub.currentPeriodEnd
        : addPeriod(event.paymentDueDate, sub.billingPeriod);
    const currentPeriodEnd =
      sub.currentPeriodEnd !== null &&
      paidUntil !== null &&
      sub.currentPeriodEnd.getTime() > paidUntil.getTime()
        ? sub.currentPeriodEnd
        : paidUntil;

    return {
      ...unchanged,
      status: 'ACTIVE',
      currentPeriodEnd,
      activated: sub.status === 'PENDING',
    };
  }

  if (event.kind === 'PAYMENT_OVERDUE') {
    return sub.status === 'ACTIVE'
      ? { ...unchanged, status: 'PAST_DUE', paymentFailed: true }
      : unchanged;
  }

  if (sub.status === 'CANCELED' || sub.status === 'EXPIRED') {
    return unchanged;
  }

  return { ...unchanged, status: 'EXPIRED', expired: true };
}
