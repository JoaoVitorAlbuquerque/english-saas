import type { Cohort } from '@english-saas/api-client';

/**
 * A matriz de retenção por coorte semanal: uma linha por semana de cadastro,
 * uma coluna por "semanas depois". Semana que ainda não aconteceu é célula
 * vazia (`null`) — não é zero, é "ainda não sei".
 */

export type RetentionTone = 'high' | 'mid' | 'low' | 'none';

export type RetentionCell = {
  retained: number;
  /** `null` = coorte vazia. */
  rate: number | null;
  /** O número escrito: `40%`. A cor só reforça, nunca é a única pista. */
  label: string;
  tone: RetentionTone;
};

export type RetentionRow = {
  cohortWeek: string;
  size: number;
  cells: (RetentionCell | null)[];
};

export type RetentionMatrix = {
  /** 0 = a semana do cadastro, 1 = a seguinte… */
  columns: number[];
  rows: RetentionRow[];
};

export function retentionTone(rate: number | null): RetentionTone {
  if (rate === null) {
    return 'none';
  }

  if (rate >= 0.4) {
    return 'high';
  }

  if (rate >= 0.2) {
    return 'mid';
  }

  return 'low';
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${String(Math.round(rate * 100))}%`;
}

export function buildRetentionMatrix(
  cohorts: readonly Cohort[],
): RetentionMatrix {
  const widest = cohorts.reduce(
    (max, cohort) =>
      Math.max(max, ...cohort.weeks.map((week) => week.offset + 1)),
    0,
  );
  const columns = Array.from({ length: widest }, (_, offset) => offset);

  return {
    columns,
    rows: [...cohorts]
      .sort((a, b) => a.cohortWeek.localeCompare(b.cohortWeek))
      .map((cohort) => ({
        cohortWeek: cohort.cohortWeek,
        size: cohort.size,
        cells: columns.map((offset) => {
          const week = cohort.weeks.find((entry) => entry.offset === offset);

          return week === undefined
            ? null
            : {
                retained: week.retained,
                rate: week.rate,
                label: formatRate(week.rate),
                tone: retentionTone(week.rate),
              };
        }),
      })),
  };
}
