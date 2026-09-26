import type { CefrLevel, Competency } from '@english-saas/shared';

/**
 * Tendências que o aluno vê: nível semana a semana, erro que está sumindo
 * e quanto do planejado ele cumpriu.
 */

export type LevelSnapshot = {
  /** Segunda-feira, `YYYY-MM-DD`. */
  weekStart: string;
  overallLevel: CefrLevel | null;
  levels: Partial<Record<Competency, { level: CefrLevel | null }>>;
};

export type WeeklyLevel = {
  weekStart: string;
  overallLevel: CefrLevel | null;
  levels: Partial<Record<Competency, CefrLevel | null>>;
};

/**
 * Nível em cada semana pedida. A foto só é gravada quando o modelo muda —
 * semana sem foto repete a última anterior (aluno parado não muda de
 * nível). Antes da primeira foto, tudo `null`.
 */
export function weeklyLevelSeries(
  snapshots: readonly LevelSnapshot[],
  weeks: readonly string[],
): WeeklyLevel[] {
  const ordered = [...snapshots].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );

  return weeks.map((week) => {
    const latest = ordered.filter((snap) => snap.weekStart <= week).at(-1);

    return {
      weekStart: week,
      overallLevel: latest?.overallLevel ?? null,
      levels:
        latest === undefined
          ? {}
          : Object.fromEntries(
              Object.entries(latest.levels).map(([competency, value]) => [
                competency,
                value?.level ?? null,
              ]),
            ),
    };
  });
}

export type ErrorTrend =
  'DECREASING' | 'STABLE' | 'INCREASING' | 'NOT_ENOUGH_DATA';

/** Menos oportunidades que isso não dizem se o erro está sumindo. */
export const MIN_TREND_OPPORTUNITIES = 6;
/** Diferença de taxa (entre as metades da janela) que conta como mudança. */
export const TREND_DELTA = 0.15;

/**
 * O erro está diminuindo? Compara a taxa de ocorrência na metade antiga da
 * janela de oportunidades (`recentOutcomes`, da mais antiga para a mais
 * nova) com a da metade recente. Taxa, não contagem: quem pratica mais tem
 * mais chances de errar.
 */
export function errorTrend(outcomes: readonly boolean[]): ErrorTrend {
  if (outcomes.length < MIN_TREND_OPPORTUNITIES) {
    return 'NOT_ENOUGH_DATA';
  }

  const middle = Math.floor(outcomes.length / 2);
  const rate = (slice: readonly boolean[]) =>
    slice.filter(Boolean).length / slice.length;
  const delta = rate(outcomes.slice(middle)) - rate(outcomes.slice(0, middle));

  if (delta <= -TREND_DELTA) return 'DECREASING';
  if (delta >= TREND_DELTA) return 'INCREASING';
  return 'STABLE';
}

export const ERROR_TREND_LABELS: Record<ErrorTrend, string> = {
  DECREASING: 'Está diminuindo',
  STABLE: 'Estável',
  INCREASING: 'Tem aparecido mais',
  NOT_ENOUGH_DATA: 'Ainda poucos dados',
};

export type WeekCompliance = {
  weekStart: string;
  plannedMinutes: number;
  studiedMinutes: number;
  /** Realizado ÷ planejado; `null` quando nada foi planejado. */
  ratio: number | null;
};

/**
 * Planejado × realizado por semana. O planejado é a disponibilidade que o
 * aluno declarou para cada dia, congelada na linha do dia.
 */
export function weeklyCompliance(
  days: readonly {
    date: string;
    plannedMinutes: number;
    studySeconds: number;
  }[],
  weeks: readonly string[],
  weekOf: (date: string) => string,
): WeekCompliance[] {
  return weeks.map((week) => {
    const inWeek = days.filter((day) => weekOf(day.date) === week);
    const plannedMinutes = inWeek.reduce(
      (sum, day) => sum + day.plannedMinutes,
      0,
    );
    const studiedMinutes = Math.round(
      inWeek.reduce((sum, day) => sum + day.studySeconds, 0) / 60,
    );

    return {
      weekStart: week,
      plannedMinutes,
      studiedMinutes,
      ratio:
        plannedMinutes === 0
          ? null
          : Math.round((studiedMinutes / plannedMinutes) * 100) / 100,
    };
  });
}
