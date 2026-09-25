export type BillingPeriod = 'MONTHLY' | 'YEARLY';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** `R$ 39,90`. Espaço comum no lugar do não separável que o Intl devolve. */
export function formatBrl(cents: number): string {
  return BRL.format(cents / 100).replace(/\s/g, ' ');
}

/**
 * O preço como o aluno lê, sem letra miúda: quanto, a cada quanto tempo, e
 * no anual quanto isso dá por mês.
 */
export function priceLabel(
  priceCents: number,
  period: BillingPeriod | null,
): string {
  if (period === null || priceCents === 0) {
    return 'Grátis';
  }

  if (period === 'MONTHLY') {
    return `${formatBrl(priceCents)} por mês`;
  }

  const perMonth = Math.round(priceCents / 12);
  return `${formatBrl(priceCents)} por ano (equivale a ${formatBrl(perMonth)} por mês)`;
}
