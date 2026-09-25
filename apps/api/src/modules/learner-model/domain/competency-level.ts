import {
  COMPETENCIES,
  type CefrLevel,
  type Competency,
  type SelfReportedLevel,
} from '@english-saas/shared';

/**
 * Nível por competência e nível geral.
 *
 * O theta de uma competência é a média das skills dela, ponderada pela
 * evidência — skill nunca praticada pesa zero e não puxa ninguém para o
 * ponto de partida. A faixa CEFR sai do theta pelos limites abaixo.
 */

/** A1 < -1.5 ≤ A2 < -0.5 ≤ B1 < 0.5 ≤ B2 < 1.5 ≤ C1. */
export const LEVEL_BANDS: readonly { level: CefrLevel; below: number }[] = [
  { level: 'A1', below: -1.5 },
  { level: 'A2', below: -0.5 },
  { level: 'B1', below: 0.5 },
  { level: 'B2', below: 1.5 },
  { level: 'C1', below: Number.POSITIVE_INFINITY },
];

/** Evidência total da competência para cada grau de confiança. */
export const CONFIDENCE_THRESHOLDS = { medium: 10, high: 30 } as const;

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type CompetencyLevel = {
  /** `null` quando não há evidência nenhuma. */
  theta: number | null;
  level: CefrLevel | null;
  confidence: Confidence;
  evidence: number;
};

export type OverallLevel = {
  level: CefrLevel;
  /**
   * De onde veio: do modelo, do que o aluno disse no onboarding, ou o
   * padrão (A1) quando não há nada. O nivelamento (8) substitui os dois
   * últimos.
   */
  source: 'MODEL' | 'SELF_REPORTED' | 'DEFAULT';
};

export function thetaToLevel(theta: number): CefrLevel {
  for (const band of LEVEL_BANDS) {
    if (theta < band.below) {
      return band.level;
    }
  }

  return 'C1';
}

export function confidenceFor(evidence: number): Confidence {
  if (evidence >= CONFIDENCE_THRESHOLDS.high) return 'HIGH';
  if (evidence >= CONFIDENCE_THRESHOLDS.medium) return 'MEDIUM';
  return 'LOW';
}

export function aggregateCompetency(
  skills: readonly { theta: number; evidence: number }[],
): CompetencyLevel {
  const evidence = skills.reduce((sum, skill) => sum + skill.evidence, 0);

  if (evidence <= 0) {
    return { theta: null, level: null, confidence: 'LOW', evidence: 0 };
  }

  const theta =
    skills.reduce((sum, skill) => sum + skill.theta * skill.evidence, 0) /
    evidence;

  return {
    theta: round(theta, 3),
    level: thetaToLevel(theta),
    confidence: confidenceFor(evidence),
    evidence: round(evidence, 1),
  };
}

export function levelsByCompetency(
  skills: readonly {
    competency: Competency;
    theta: number;
    evidence: number;
  }[],
): Record<Competency, CompetencyLevel> {
  return Object.fromEntries(
    COMPETENCIES.map((competency) => [
      competency,
      aggregateCompetency(
        skills.filter((skill) => skill.competency === competency),
      ),
    ]),
  ) as Record<Competency, CompetencyLevel>;
}

const SELF_REPORTED_TO_LEVEL: Record<SelfReportedLevel, CefrLevel> = {
  NONE: 'A1',
  BASIC: 'A1',
  INTERMEDIATE: 'B1',
  ADVANCED: 'B2',
};

/**
 * Nível geral, com regra conservadora: a **mediana** das competências com
 * confiança média ou alta. Com número par, a menor das duas do meio —
 * errar para baixo custa uma lição fácil; errar para cima custa um aluno
 * perdido.
 *
 * Sem competência confiável, cai para o que o aluno disse no onboarding.
 */
export function overallLevel(
  levels: Record<Competency, CompetencyLevel>,
  selfReported: SelfReportedLevel | null,
): OverallLevel {
  const thetas = Object.values(levels)
    .filter((entry) => entry.confidence !== 'LOW' && entry.theta !== null)
    .map((entry) => entry.theta as number)
    .sort((a, b) => a - b);

  if (thetas.length > 0) {
    const median = thetas[Math.floor((thetas.length - 1) / 2)] as number;
    return { level: thetaToLevel(median), source: 'MODEL' };
  }

  if (selfReported !== null) {
    return {
      level: SELF_REPORTED_TO_LEVEL[selfReported],
      source: 'SELF_REPORTED',
    };
  }

  return { level: 'A1', source: 'DEFAULT' };
}

/** O nível seguinte, ou o mesmo no topo. */
export function nextLevel(level: CefrLevel): CefrLevel {
  const index = LEVEL_BANDS.findIndex((band) => band.level === level);
  return (
    LEVEL_BANDS[Math.min(index + 1, LEVEL_BANDS.length - 1)]?.level ?? level
  );
}

/** Segunda-feira da semana do instante, em UTC, como `YYYY-MM-DD`. */
export function weekStartOf(instant: Date): string {
  const day = instant.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate() - offset,
    ),
  );

  return monday.toISOString().slice(0, 10);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
