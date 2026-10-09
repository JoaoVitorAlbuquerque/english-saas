import { t, type MessageKey } from '../../../messages/pt-BR';

/** "Plus mensal", "Base anual", "Gratuito". */
export function planName(
  tier: string,
  billingPeriod: string | null | undefined,
): string {
  const name = tierLabel(tier) ?? tier;
  const period =
    billingPeriod === 'MONTHLY' || billingPeriod === 'YEARLY'
      ? t(`plans.period.${billingPeriod}` as MessageKey)
      : null;

  return period === null ? name : `${name} ${period}`;
}

export function tierLabel(tier: string): string | null {
  return tier === 'FREE' || tier === 'BASE' || tier === 'PLUS'
    ? t(`plans.tier.${tier}` as MessageKey)
    : null;
}
