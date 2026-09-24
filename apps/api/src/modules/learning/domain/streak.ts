/**
 * Sequência de dias estudados.
 *
 * Um dia conta quando o aluno faz **qualquer** coisa de estudo — concluir
 * uma etapa ou responder uma questão —, e o dia é o **do aluno**: 23h30 em
 * São Paulo ainda é hoje lá, mesmo que no UTC já seja amanhã.
 *
 * Nada de vidas nem punição (CLAUDE.md): perder um dia volta a sequência
 * para 1 no próximo estudo, e é só isso. O recorde fica guardado.
 *
 * O relógio entra por parâmetro — `domain/` não lê `Date.now()`.
 */

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  /** `YYYY-MM-DD` no fuso do aluno, ou `null` se nunca estudou. */
  lastStudyDate: string | null;
};

/**
 * A data local de um instante, como `YYYY-MM-DD`.
 *
 * Fuso inválido cai no padrão em vez de quebrar: o fuso vem do perfil, e
 * um valor ruim lá não pode impedir o aluno de registrar o estudo.
 */
export function localDate(instant: Date, timeZone: string): string {
  try {
    return formatDate(instant, timeZone);
  } catch {
    return formatDate(instant, DEFAULT_TIMEZONE);
  }
}

function formatDate(instant: Date, timeZone: string): string {
  // en-CA formata como YYYY-MM-DD, que é exatamente o que queremos.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Diferença em dias de calendário entre duas datas `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  const DAY_MS = 86_400_000;
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

function toUtcMidnight(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * Registra que o aluno estudou em `today` (data local).
 *
 * - mesmo dia: nada muda;
 * - dia seguinte: +1;
 * - pulou um ou mais dias: recomeça em 1;
 * - data **anterior** à última (o aluno mudou de fuso para oeste): nada
 *   muda. Voltar no calendário não é motivo para zerar ninguém.
 */
export function registerStudyDay(
  state: StreakState,
  today: string,
): StreakState {
  if (state.lastStudyDate === null) {
    return withLongest({ ...state, currentStreak: 1, lastStudyDate: today });
  }

  const gap = daysBetween(state.lastStudyDate, today);

  if (gap <= 0) {
    return state;
  }

  const currentStreak = gap === 1 ? state.currentStreak + 1 : 1;

  return withLongest({ ...state, currentStreak, lastStudyDate: today });
}

/**
 * A sequência que se mostra hoje.
 *
 * O banco só é atualizado quando o aluno estuda, então quem parou há uma
 * semana ainda tem `currentStreak = 12` gravado. Ontem ainda vale (o dia de
 * hoje não acabou); antes disso, a sequência já foi.
 */
export function visibleStreak(state: StreakState, today: string): number {
  if (state.lastStudyDate === null) {
    return 0;
  }

  return daysBetween(state.lastStudyDate, today) <= 1 ? state.currentStreak : 0;
}

function withLongest(state: StreakState): StreakState {
  return {
    ...state,
    longestStreak: Math.max(state.longestStreak, state.currentStreak),
  };
}
