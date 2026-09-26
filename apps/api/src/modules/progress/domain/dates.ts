/**
 * Datas de calendário como `YYYY-MM-DD`, sem fuso — o dia local do aluno
 * ou o dia do fuso das métricas. Aritmética feita em UTC, onde não existe
 * horário de verão para atrapalhar.
 */

const DAY_MS = 86_400_000;

function toUtcMidnight(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function fromUtcMidnight(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtcMidnight(toUtcMidnight(date) + days * DAY_MS);
}

/** Dias de `from` até `to`, inclusive. Vazio se `to` vem antes. */
export function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];

  for (let ms = toUtcMidnight(from); ms <= toUtcMidnight(to); ms += DAY_MS) {
    dates.push(fromUtcMidnight(ms));
  }

  return dates;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

/** Segunda-feira da semana — mesma convenção do `LearnerLevelSnapshot`. */
export function weekStart(date: string): string {
  const day = new Date(toUtcMidnight(date)).getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

/** As últimas `count` semanas até a de `date`, da mais antiga para a atual. */
export function recentWeeks(date: string, count: number): string[] {
  const current = weekStart(date);
  return Array.from({ length: count }, (_, index) =>
    addDays(current, (index - count + 1) * 7),
  );
}

/** Dia da semana no formato da disponibilidade do perfil. */
export function weekdayKey(
  date: string,
): 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  return keys[new Date(toUtcMidnight(date)).getUTCDay()] ?? 'mon';
}

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * O fuso, se o `Intl` conhece; senão o padrão. O fuso vem do perfil, e um
 * valor ruim lá não pode derrubar a agregação da noite inteira.
 */
export function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** A data local de um instante no fuso. */
export function localDateOf(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * O intervalo UTC `[start, end)` de um dia local num fuso.
 *
 * O deslocamento do fuso é lido no próprio instante (duas passadas), então
 * o dia em que começa ou termina o horário de verão sai com 23 ou 25 horas,
 * como é de verdade.
 */
export function localDayBounds(
  date: string,
  timeZone: string,
): { start: Date; end: Date } {
  const zone = safeTimeZone(timeZone);

  return {
    start: new Date(localMidnight(date, zone)),
    end: new Date(localMidnight(addDays(date, 1), zone)),
  };
}

function localMidnight(date: string, timeZone: string): number {
  const wall = toUtcMidnight(date);
  let guess = wall - offsetMs(wall, timeZone);
  guess = wall - offsetMs(guess, timeZone);
  return guess;
}

/** Quanto o relógio do fuso está à frente do UTC naquele instante. */
function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );

  return asUtc - Math.floor(instant / 1000) * 1000;
}
