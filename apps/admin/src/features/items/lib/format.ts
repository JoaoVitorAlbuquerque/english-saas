/**
 * Formatação dos números do banco de questões, sempre no formato do
 * navegador do editor (pt-BR): vírgula decimal, data curta.
 */

const NUMBER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Dificuldade em logit, com sinal: `+0,90`, `-2,00`, `0,00`. */
export function formatDifficulty(value: number): string {
  return NUMBER.format(value).replace('−', '-');
}

/** `0.07` → `7%`. */
export function formatPercent(value: number): string {
  return PERCENT.format(value);
}

/** ISO → `17/10/2026` (em UTC: a calibração roda de madrugada, e o dia importa). */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}
