import { addDays, daysBetween } from './dates';

/**
 * Métricas de plataforma a partir das tabelas diárias. Tudo puro: o job lê
 * as linhas e grava o resultado; a rota do admin só soma.
 */

/** Tentativa parada há tanto tempo, sem concluir, conta como abandono. */
export const STALL_DAYS = 7;

/** Abaixo disso, a taxa de uma lição é ruído, não sinal. */
export const MIN_LESSON_STARTS = 10;

/**
 * DAU, WAU e MAU do dia `date`: alunos distintos com atividade no próprio
 * dia, nos últimos 7 e nos últimos 30 dias (contando `date`).
 */
export function activeUsers(
  activeDays: readonly { userId: string; date: string }[],
  date: string,
): { dau: number; wau: number; mau: number } {
  const within = (days: number) =>
    new Set(
      activeDays
        .filter((row) => {
          const age = daysBetween(row.date, date);
          return age >= 0 && age < days;
        })
        .map((row) => row.userId),
    ).size;

  return { dau: within(1), wau: within(7), mau: within(30) };
}

export type CohortCell = {
  cohortWeek: string;
  weekOffset: number;
  cohortSize: number;
  retained: number;
};

/**
 * Retenção por coorte semanal: dos que se cadastraram na semana X, quantos
 * estiveram ativos na semana X + n. A semana 0 é a do próprio cadastro.
 * Semana que ainda não começou não entra — não é zero, é "ainda não sei".
 */
export function cohortRetention(input: {
  signups: readonly { userId: string; cohortWeek: string }[];
  activeWeeks: readonly { userId: string; week: string }[];
  currentWeek: string;
}): CohortCell[] {
  const cohorts = new Map<string, Set<string>>();

  for (const signup of input.signups) {
    const members = cohorts.get(signup.cohortWeek) ?? new Set<string>();
    members.add(signup.userId);
    cohorts.set(signup.cohortWeek, members);
  }

  const activeByWeek = new Map<string, Set<string>>();
  for (const row of input.activeWeeks) {
    const users = activeByWeek.get(row.week) ?? new Set<string>();
    users.add(row.userId);
    activeByWeek.set(row.week, users);
  }

  const cells: CohortCell[] = [];

  for (const [cohortWeek, members] of [...cohorts.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const weeks = Math.floor(daysBetween(cohortWeek, input.currentWeek) / 7);

    for (let offset = 0; offset <= weeks; offset += 1) {
      const active = activeByWeek.get(addDays(cohortWeek, offset * 7));
      const retained =
        active === undefined
          ? 0
          : [...members].filter((userId) => active.has(userId)).length;

      cells.push({
        cohortWeek,
        weekOffset: offset,
        cohortSize: members.size,
        retained,
      });
    }
  }

  return cells;
}

export type StalledAttempt = {
  lessonId: string;
  stepIndex: number;
  stepType: string | null;
};

export type StepDropoff = {
  stepIndex: number;
  stepType: string | null;
  count: number;
};

/** Abandono por lição, agrupado pela etapa em que o aluno parou. */
export function abandonmentFunnel(
  stalled: readonly StalledAttempt[],
): Map<string, { abandoned: number; byStep: StepDropoff[] }> {
  const byLesson = new Map<string, Map<number, StepDropoff>>();

  for (const attempt of stalled) {
    const steps = byLesson.get(attempt.lessonId) ?? new Map();
    const current = steps.get(attempt.stepIndex) ?? {
      stepIndex: attempt.stepIndex,
      stepType: attempt.stepType,
      count: 0,
    };
    steps.set(attempt.stepIndex, { ...current, count: current.count + 1 });
    byLesson.set(attempt.lessonId, steps);
  }

  return new Map(
    [...byLesson.entries()].map(([lessonId, steps]) => {
      const byStep = [...steps.values()].sort(
        (a, b) => a.stepIndex - b.stepIndex,
      );
      return [
        lessonId,
        {
          abandoned: byStep.reduce((sum, step) => sum + step.count, 0),
          byStep,
        },
      ];
    }),
  );
}

/** Junta a etapa de abandono de várias linhas diárias da mesma lição. */
export function mergeDropoffs(lists: readonly StepDropoff[][]): StepDropoff[] {
  const merged = new Map<number, StepDropoff>();

  for (const step of lists.flat()) {
    const current = merged.get(step.stepIndex);
    merged.set(step.stepIndex, {
      stepIndex: step.stepIndex,
      stepType: current?.stepType ?? step.stepType,
      count: (current?.count ?? 0) + step.count,
    });
  }

  return [...merged.values()].sort((a, b) => a.stepIndex - b.stepIndex);
}

export type LessonTotals = {
  lessonId: string;
  started: number;
  completed: number;
  firstTryAnswers: number;
  firstTryCorrect: number;
  abandoned: number;
};

export type RankedLesson = LessonTotals & {
  completionRate: number;
  accuracy: number | null;
};

export function rankLesson(totals: LessonTotals): RankedLesson {
  return {
    ...totals,
    completionRate:
      totals.started === 0 ? 0 : round(totals.completed / totals.started),
    accuracy:
      totals.firstTryAnswers === 0
        ? null
        : round(totals.firstTryCorrect / totals.firstTryAnswers),
  };
}

/**
 * As lições com pior desempenho: menor conclusão, depois menor acerto de
 * primeira. Só entra quem tem volume — com 2 alunos, uma desistência vira
 * 50% de abandono.
 */
export function worstLessons(
  totals: readonly LessonTotals[],
  options: { minStarts?: number; limit?: number } = {},
): RankedLesson[] {
  const minStarts = options.minStarts ?? MIN_LESSON_STARTS;

  return totals
    .filter((lesson) => lesson.started >= minStarts)
    .map(rankLesson)
    .sort(
      (a, b) =>
        a.completionRate - b.completionRate ||
        (a.accuracy ?? 1) - (b.accuracy ?? 1) ||
        a.lessonId.localeCompare(b.lessonId),
    )
    .slice(0, options.limit ?? 10);
}

/** MRR de uma assinatura: anual vale 1/12 por mês. */
export function monthlyRevenueCents(sub: {
  priceCents: number;
  billingPeriod: 'MONTHLY' | 'YEARLY';
}): number {
  return sub.billingPeriod === 'YEARLY'
    ? Math.round(sub.priceCents / 12)
    : sub.priceCents;
}

/** Custo de IA (milionésimos de dólar) em centavos de real. */
export function usdMicrosToBrlCents(
  micros: number,
  usdBrlRate: number,
): number {
  return Math.round((micros / 1_000_000) * usdBrlRate * 100);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
