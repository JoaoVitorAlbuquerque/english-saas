import { addDays, daysBetween } from './dates';

/**
 * Previsão de chegada ao nível-alvo pelo **ritmo real**.
 *
 * O planner (10) já prevê uma data pela disponibilidade declarada. Aqui a
 * pergunta é outra: "no ritmo em que você está estudando, quando chega?".
 * Se o aluno estuda metade do que planejou, o que falta leva o dobro — a
 * mesma trilha, o mesmo modelo de tempo do planner, só a velocidade muda.
 */

/** Semanas completas de dado necessárias para falar em ritmo. */
export const MIN_PACE_WEEKS = 2;
/** Mesmo teto do forecast do planner. */
const MAX_FORECAST_DAYS = 5 * 365;

export type PaceStatus =
  'ON_TRACK' | 'AHEAD' | 'BEHIND' | 'TOO_EARLY' | 'NO_STUDY' | 'NO_PLAN';

export type PaceForecast = {
  byPlan: string | null;
  byPace: string | null;
  /** Positivo = atrasado; negativo = adiantado. */
  weeksDifference: number | null;
  status: PaceStatus;
  message: string;
};

export function paceForecast(input: {
  today: string;
  /** `forecast.estimatedArrival` do planner. */
  planArrival: string | null;
  plannedWeeklyMinutes: number;
  /** Minutos estudados nas últimas semanas completas. */
  recentWeeklyMinutes: readonly number[];
}): PaceForecast {
  const { today, planArrival } = input;
  const base = { byPlan: planArrival, byPace: null, weeksDifference: null };

  if (planArrival === null || input.plannedWeeklyMinutes <= 0) {
    return {
      ...base,
      status: 'NO_PLAN',
      message:
        'Monte seu cronograma com os dias em que pode estudar para ver a previsão.',
    };
  }

  if (input.recentWeeklyMinutes.length < MIN_PACE_WEEKS) {
    return {
      ...base,
      status: 'TOO_EARLY',
      message: `Pelo seu cronograma, você chega lá em ${formatDate(planArrival)}. Com mais algumas semanas de estudo, dá para prever pelo seu ritmo.`,
    };
  }

  const average =
    input.recentWeeklyMinutes.reduce((sum, minutes) => sum + minutes, 0) /
    input.recentWeeklyMinutes.length;

  if (average <= 0) {
    return {
      ...base,
      status: 'NO_STUDY',
      message:
        'Nas últimas semanas não teve estudo registrado. Retomando, a previsão volta a andar.',
    };
  }

  const remainingDays = Math.max(0, daysBetween(today, planArrival));
  const paceDays = Math.round(
    remainingDays * (input.plannedWeeklyMinutes / average),
  );

  if (paceDays > MAX_FORECAST_DAYS) {
    return {
      ...base,
      status: 'BEHIND',
      message:
        'No ritmo atual, a chegada passa de cinco anos. Vale ajustar a rotina ou o cronograma.',
    };
  }

  const byPace = addDays(today, paceDays);
  const weeksDifference =
    Math.round((daysBetween(planArrival, byPace) / 7) * 10) / 10;
  const weeks = Math.round(Math.abs(weeksDifference));

  if (weeks < 1) {
    return {
      byPlan: planArrival,
      byPace,
      weeksDifference,
      status: 'ON_TRACK',
      message: `Você está no ritmo: a chegada prevista é ${formatDate(byPace)}.`,
    };
  }

  return weeksDifference > 0
    ? {
        byPlan: planArrival,
        byPace,
        weeksDifference,
        status: 'BEHIND',
        message: `No ritmo atual, você chega em ${formatDate(byPace)} — ${plural(weeks)} depois do previsto.`,
      }
    : {
        byPlan: planArrival,
        byPace,
        weeksDifference,
        status: 'AHEAD',
        message: `No ritmo atual, você chega em ${formatDate(byPace)} — ${plural(weeks)} antes do previsto.`,
      };
}

function plural(weeks: number): string {
  return weeks === 1 ? '1 semana' : `${String(weeks)} semanas`;
}

/** `2026-11-03` → `03/11/2026`. */
function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}
