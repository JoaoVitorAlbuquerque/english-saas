import type { Feature, PlanTier } from './entitlements';

export type CreditFeature = Exclude<Feature, 'LESSON_ACCESS' | 'PDF_DOWNLOAD'>;

/**
 * Quanto cada uso de IA custa em créditos.
 *
 * Em código de propósito: mexer aqui muda a economia do plano e merece
 * revisão. `GENERATOR_INGEST` segue o mesmo preço do material por tema.
 */
export const AI_CREDIT_COSTS: Record<CreditFeature, number> = {
  TUTOR_CORRECTION: 1,
  TUTOR_ROLEPLAY: 3,
  GENERATOR_TOPIC: 5,
  GENERATOR_INGEST: 5,
};

export function isCreditFeature(feature: Feature): feature is CreditFeature {
  return feature in AI_CREDIT_COSTS;
}

export function balanceFrom(entries: readonly { amount: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

/** Quantas vezes o saldo ainda paga a feature. */
export function remainingUses(balance: number, feature: CreditFeature): number {
  return Math.max(0, Math.floor(balance / AI_CREDIT_COSTS[feature]));
}

/**
 * Crédito do ciclo: repõe até a cota do plano. Sobra não acumula acima da
 * cota, mas também não se perde — quem tem mais que a cota não recebe nada.
 */
export function monthlyTopUp(balance: number, monthlyCredits: number): number {
  return Math.max(0, monthlyCredits - balance);
}

/** `PLUS:2026-09` — mês em UTC. Chave de dedup do crédito mensal. */
export function creditCycleKey(tier: PlanTier, now: Date): string {
  return `${tier}:${now.toISOString().slice(0, 7)}`;
}

/**
 * Quando o cron do crédito mensal roda: dia 1º, 00:05 UTC — para todo
 * aluno, pago ou não (o pago também recebe no webhook, mas a chave do ciclo
 * é por mês, então o cron é o que vale para o próximo mês). Mudou um, muda
 * o outro: o scheduler lê daqui.
 */
export const MONTHLY_GRANT_CRON = '5 0 1 * *';
const GRANT_MINUTE_UTC = 5;

/** Próximo disparo de `MONTHLY_GRANT_CRON` depois de `now`. */
export function nextCreditGrantAt(now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const thisMonth = new Date(Date.UTC(year, month, 1, 0, GRANT_MINUTE_UTC));

  return now < thisMonth
    ? thisMonth
    : new Date(Date.UTC(year, month + 1, 1, 0, GRANT_MINUTE_UTC));
}
