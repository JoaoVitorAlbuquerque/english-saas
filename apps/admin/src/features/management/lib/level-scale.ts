import type { ProgressCompetency, WeeklyLevel } from '@english-saas/api-client';
import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';
import type {
  BarChartItem,
  ChartScale,
  LineChartPoint,
} from '@english-saas/ui';

import { formatDay } from './period';

/**
 * O nível CEFR vira número só aqui, para desenhar: A1 = 1 … C1 = 5. Os
 * gráficos do `packages/ui` não sabem o que é CEFR. (Mesma escala do app do
 * aluno — `apps/web/src/features/progress/lib/level-scale.ts`.)
 */
export function levelValue(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level) + 1;
}

export function levelAt(value: number): CefrLevel | null {
  return CEFR_LEVELS[Math.round(value) - 1] ?? null;
}

const LEVEL_TICKS = CEFR_LEVELS.map((level) => ({
  value: levelValue(level),
  label: level,
}));

/** Barras: o fim da barra cai exatamente na marca do nível. */
export const BAR_SCALE: ChartScale = {
  min: 0,
  max: CEFR_LEVELS.length,
  ticks: LEVEL_TICKS,
};

/** Linha: meio degrau de folga em cima e embaixo. */
export const LINE_SCALE: ChartScale = {
  min: 0.5,
  max: CEFR_LEVELS.length + 0.5,
  ticks: LEVEL_TICKS,
};

/**
 * Uma barra por competência. Confiança baixa (e só ela) fica listrada e com
 * o texto "poucos dados"; sem nível ainda, a linha diz que não há dado.
 */
export function competencyBars(
  competencies: readonly ProgressCompetency[],
  lowConfidenceLabel: string,
): BarChartItem[] {
  return competencies.map((entry) => {
    if (entry.level === null) {
      return {
        id: entry.competency,
        label: entry.label,
        value: null,
        valueLabel: '',
      };
    }

    const isLow = entry.confidenceLevel === 'LOW';

    return {
      id: entry.competency,
      label: entry.label,
      value: levelValue(entry.level),
      valueLabel: entry.level,
      note: isLow ? lowConfidenceLabel : entry.confidence,
      hatched: isLow,
    };
  });
}

/** O nível geral semana a semana, para a linha. */
export function overallPoints(
  weekly: readonly WeeklyLevel[],
): LineChartPoint[] {
  return weekly.map((week) => ({
    x: formatDay(week.weekStart),
    y: week.overallLevel === null ? null : levelValue(week.overallLevel),
  }));
}
