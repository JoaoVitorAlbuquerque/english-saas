import type { ProgressCompetency, WeeklyLevel } from '@english-saas/api-client';
import {
  CEFR_LEVELS,
  type CefrLevel,
  type Competency,
} from '@english-saas/shared';
import type {
  BarChartItem,
  ChartScale,
  LineChartPoint,
} from '@english-saas/ui';

import { formatWeek } from './format-date';

/**
 * O nível CEFR vira número só aqui, para desenhar: A1 = 1 … C1 = 5. Os
 * gráficos do `packages/ui` não sabem o que é CEFR.
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

/** Linha: meio degrau de folga em cima e embaixo, para o A1 e o C1 não colarem na borda. */
export const LINE_SCALE: ChartScale = {
  min: 0.5,
  max: CEFR_LEVELS.length + 0.5,
  ticks: LEVEL_TICKS,
};

/**
 * Uma linha de barra por competência. Confiança baixa (e só ela) fica
 * listrada e com o texto "poucos dados"; as outras mostram o rótulo que a
 * API mandou ("Estimativa razoável").
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

export type EvolutionFocus = 'OVERALL' | Competency;

/** Os pontos da linha: nível geral ou de uma competência, semana a semana. */
export function levelPoints(
  weekly: readonly WeeklyLevel[],
  focus: EvolutionFocus,
): LineChartPoint[] {
  return weekly.map((week) => {
    const level =
      focus === 'OVERALL' ? week.overallLevel : (week.levels[focus] ?? null);

    return {
      x: formatWeek(week.weekStart),
      y: level === null ? null : levelValue(level),
    };
  });
}
