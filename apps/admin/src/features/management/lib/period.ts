import { METRICS_MAX_DAYS } from '@english-saas/api-client';

/**
 * Datas de métricas são `YYYY-MM-DD`, sem fuso: a conta é feita sobre o texto
 * (UTC), nunca com `new Date(texto)` solto — o fuso deslocaria o dia.
 */

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Quantos dias o intervalo cobre, contando os dois extremos. */
export function daysInRange(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

/** Os atalhos de período. */
export const PERIOD_PRESETS = [7, 30, 90, 180] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** O atalho termina no mesmo dia em que a API terminou o padrão (ontem). */
export function presetRange(
  anchorTo: string,
  days: number,
): { from: string; to: string } {
  return { from: addDays(anchorTo, -(days - 1)), to: anchorTo };
}

/** Qual atalho o intervalo é, se for algum. */
export function presetOf(
  range: { from: string; to: string },
  anchorTo: string,
): PeriodPreset | null {
  if (range.to !== anchorTo) {
    return null;
  }

  const days = daysInRange(range.from, range.to);

  return PERIOD_PRESETS.find((preset) => preset === days) ?? null;
}

export type RangeProblem = 'EMPTY' | 'ORDER' | 'TOO_LONG';

/** O mesmo que a API recusa — o formulário avisa antes de mandar. */
export function rangeProblem(from: string, to: string): RangeProblem | null {
  if (from === '' || to === '') {
    return 'EMPTY';
  }

  if (from > to) {
    return 'ORDER';
  }

  // A API recusa diferença de 180 dias ou mais (181 dias contados).
  return daysInRange(from, to) > METRICS_MAX_DAYS ? 'TOO_LONG' : null;
}

/** `2026-10-07` → `07/10`. */
export function formatDay(date: string): string {
  const [, month, day] = date.split('-');

  return `${day ?? ''}/${month ?? ''}`;
}

/** `2026-10-07` → `07/10/2026`. */
export function formatFullDay(date: string): string {
  const [year, month, day] = date.split('-');

  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}

/**
 * Início e fim de um dia **no fuso de quem olha**, em ISO — é o que o filtro
 * do log de auditoria manda (o servidor guarda instantes UTC).
 */
export function localDayBounds(date: string): { from: string; to: string } {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);

  return {
    from: new Date(year, month - 1, day, 0, 0, 0, 0).toISOString(),
    to: new Date(year, month - 1, day, 23, 59, 59, 999).toISOString(),
  };
}
