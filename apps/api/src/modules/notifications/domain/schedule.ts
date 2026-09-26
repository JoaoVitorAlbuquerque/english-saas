/**
 * Quando mandar. Tudo em hora local do aluno — o fuso é resolvido fora,
 * aqui só chegam números.
 */

export type PreferredStudyTime =
  'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'ANY';

/** Hora do lembrete quando o aluno não escolheu uma. */
export const STUDY_TIME_HOURS: Record<PreferredStudyTime, number> = {
  MORNING: 8,
  AFTERNOON: 13,
  EVENING: 19,
  NIGHT: 21,
  ANY: 19,
};

export function reminderHourFor(
  chosen: number | null,
  preferred: PreferredStudyTime,
): number {
  return chosen ?? STUDY_TIME_HOURS[preferred];
}

/**
 * A hora cai no silencioso? A janela é `[start, end)` e pode atravessar a
 * meia-noite (22 → 8). `start === end` é "sem horário silencioso".
 */
export function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) {
    return false;
  }

  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}

export type LocalClock = {
  /** `YYYY-MM-DD`. */
  date: string;
  hour: number;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
};

/** Data, hora e dia da semana locais de um instante. */
export function localClock(instant: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
  }).formatToParts(instant);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    weekday: Math.max(0, weekdays.indexOf(value('weekday'))),
  };
}

/** Segunda-feira: o dia do resumo semanal. */
export const WEEKLY_SUMMARY_WEEKDAY = 1;
