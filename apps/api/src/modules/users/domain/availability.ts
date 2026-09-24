import {
  MAX_MINUTES_PER_DAY,
  WEEKDAYS,
  type AvailabilityMinutes,
  type Weekday,
} from '@english-saas/shared';

/**
 * Disponibilidade semanal do aluno, em minutos por dia.
 *
 * O planejador (módulo 10) monta o cronograma em cima disso, então o valor
 * guardado tem que estar sempre completo e dentro dos limites — nunca com
 * dia faltando ou número negativo vindo do cliente.
 */

/** Preenche os dias ausentes com 0 e prende cada valor no intervalo válido. */
export function normalizeAvailability(
  input: Partial<Record<Weekday, number>> | null | undefined,
): AvailabilityMinutes {
  const normalized = {} as AvailabilityMinutes;

  for (const day of WEEKDAYS) {
    const raw = input?.[day];
    const minutes =
      typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0;

    normalized[day] = Math.min(Math.max(minutes, 0), MAX_MINUTES_PER_DAY);
  }

  return normalized;
}

export function totalWeeklyMinutes(availability: AvailabilityMinutes): number {
  return WEEKDAYS.reduce((sum, day) => sum + availability[day], 0);
}

/** Dias em que o aluno reservou algum tempo. */
export function activeStudyDays(availability: AvailabilityMinutes): Weekday[] {
  return WEEKDAYS.filter((day) => availability[day] > 0);
}

/**
 * Quantos dias de estudo cabem entre hoje e a data-alvo, considerando só os
 * dias da semana em que o aluno tem tempo. Base do cronograma do módulo 10.
 */
export function studyDaysUntil(
  availability: AvailabilityMinutes,
  from: Date,
  targetDate: Date,
): number {
  if (targetDate.getTime() <= from.getTime()) {
    return 0;
  }

  const active = new Set(activeStudyDays(availability));

  if (active.size === 0) {
    return 0;
  }

  // getUTCDay(): 0 = domingo. WEEKDAYS começa na segunda.
  const indexToWeekday: Weekday[] = [
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
  ];

  let count = 0;
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
  );

  while (cursor.getTime() <= end) {
    const weekday = indexToWeekday[cursor.getUTCDay()];

    if (weekday !== undefined && active.has(weekday)) {
      count += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}
