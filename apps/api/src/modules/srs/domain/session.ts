import type { ReviewCardKind } from './card-creation';

/**
 * Monta a sessão de revisão: cards vencidos, ordenados por prioridade, e
 * cortados pelo tempo que o aluno tem.
 *
 * O corte **é** o espalhamento de backlog: quem ficou dias sem estudar tem
 * mais cards vencidos do que cabe numa sessão. O que não coube continua
 * vencido — o `due` guardado não muda — e aparece nas próximas sessões, até
 * um por dia até zerar. Não é preciso reagendar nada.
 */

/** Segundos que um card leva, em média, para estimar quantos cabem no tempo. */
export const DEFAULT_SECONDS_PER_CARD = 25;

export type CardForSession = {
  id: string;
  kind: ReviewCardKind;
  due: Date;
  lapses: number;
};

/** Erro recorrente entra primeiro: é ERROR_PATTERN, ou já lapsou mais de uma vez. */
export function isRecurring(card: CardForSession): boolean {
  return card.kind === 'ERROR_PATTERN' || card.lapses >= 2;
}

function overdueMs(card: CardForSession, now: Date): number {
  return now.getTime() - card.due.getTime();
}

/** Menor valor = maior prioridade. Recorrente primeiro, depois mais atrasado. */
export function sessionOrder<T extends CardForSession>(
  cards: readonly T[],
  now: Date,
): T[] {
  return [...cards].sort((a, b) => {
    const recurringDiff = Number(isRecurring(b)) - Number(isRecurring(a));
    return recurringDiff !== 0
      ? recurringDiff
      : overdueMs(b, now) - overdueMs(a, now);
  });
}

export function sessionCapacity(
  minutes: number,
  secondsPerCard: number = DEFAULT_SECONDS_PER_CARD,
): number {
  return Math.max(0, Math.floor((minutes * 60) / secondsPerCard));
}

export function buildSession<T extends CardForSession>(
  cards: readonly T[],
  now: Date,
  minutes: number,
  secondsPerCard: number = DEFAULT_SECONDS_PER_CARD,
): T[] {
  return sessionOrder(cards, now).slice(
    0,
    sessionCapacity(minutes, secondsPerCard),
  );
}
