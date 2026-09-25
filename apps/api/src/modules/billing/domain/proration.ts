import { TIER_RANK, type PlanTier } from './entitlements';
import type { BillingPeriod } from './pricing';
import { addPeriod } from './subscription-state';

/** Menor cobrança que o Asaas aceita. O desconto nunca leva a 1ª abaixo disso. */
export const MIN_CHARGE_CENTS = 500;

/** Upgrade é só para tier maior, a partir de uma assinatura em dia. */
export function isUpgrade(input: {
  currentTier: PlanTier;
  currentStatus: string;
  targetTier: PlanTier;
}): boolean {
  return (
    input.currentStatus === 'ACTIVE' &&
    TIER_RANK[input.targetTier] > TIER_RANK[input.currentTier]
  );
}

/**
 * Quanto do plano atual ainda não foi usado, em centavos — vira desconto na
 * 1ª cobrança do plano novo. Proporcional ao tempo que falta no ciclo pago,
 * limitado para a cobrança nova não ficar abaixo do mínimo do gateway.
 */
export function upgradeCreditCents(input: {
  currentPriceCents: number;
  currentPeriod: BillingPeriod;
  currentPeriodEnd: Date | null;
  newPriceCents: number;
  now: Date;
}): number {
  const end = input.currentPeriodEnd;

  if (end === null || end.getTime() <= input.now.getTime()) {
    return 0;
  }

  const start = addPeriod(end, input.currentPeriod, -1);
  const total = end.getTime() - start.getTime();
  const remaining = Math.min(total, end.getTime() - input.now.getTime());
  const credit = Math.floor((input.currentPriceCents * remaining) / total);

  return Math.max(0, Math.min(credit, input.newPriceCents - MIN_CHARGE_CENTS));
}
