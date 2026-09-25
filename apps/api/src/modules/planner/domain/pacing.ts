/**
 * Quanto o ritmo real ficou atrás do previsto.
 *
 * Compara o progresso esperado (tempo corrido / prazo original) com o
 * progresso real (minutos de lição concluídos / minutos planejados). Mais
 * de uma semana de atraso é o gatilho pra recalcular o forecast — dia
 * perdido isolado não mexe em nada, o SRS (9) já espalha o backlog sozinho.
 */

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function weeksBehind(input: {
  planCreatedAt: Date;
  now: Date;
  /** `forecast.weeksNeeded` no momento em que o plano foi montado. */
  expectedWeeksTotal: number;
  /** Minutos de lição do path concluídos desde `planCreatedAt`. */
  completedMinutes: number;
  /** Minutos totais do path no momento em que foi montado. */
  totalMinutesPlanned: number;
}): number {
  if (input.totalMinutesPlanned <= 0 || input.expectedWeeksTotal <= 0) {
    return 0;
  }

  const elapsedWeeks =
    (input.now.getTime() - input.planCreatedAt.getTime()) / WEEK_MS;
  const expectedProgress = Math.min(1, elapsedWeeks / input.expectedWeeksTotal);
  const actualProgress = Math.min(
    1,
    input.completedMinutes / input.totalMinutesPlanned,
  );
  const gap = Math.max(0, expectedProgress - actualProgress);

  return gap * input.expectedWeeksTotal;
}

export function needsRecalculation(weeks: number): boolean {
  return weeks >= 1;
}
