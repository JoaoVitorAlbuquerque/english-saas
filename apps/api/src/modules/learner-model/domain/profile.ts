import type { CefrLevel, LearningGoal } from '@english-saas/shared';

/**
 * Pontos fortes, pontos fracos e o que o aluno precisa agora.
 *
 * Tudo aqui trabalha sobre números já calculados (mastery, evidência,
 * ocorrências de erro) — a estimativa em si é de `mastery.ts`.
 */

export const PROFILE_RULES = {
  strong: { minMastery: 0.8, minEvidence: 6 },
  weak: { maxMastery: 0.5, minEvidence: 4 },
  /** Abaixo disto a skill ainda "não tem evidência suficiente". */
  sufficientEvidence: 6,
  maxTargets: 5,
} as const;

/** Pesos da prioridade das necessidades. */
export const NEED_WEIGHTS = {
  /** Multiplica a fração "é pré-requisito de quantas" (0–1). */
  prerequisite: 1,
  weakness: 1.5,
  goal: 0.5,
  /** Skill do nível atual vem antes da do próximo. */
  currentLevel: 0.3,
} as const;

export type SkillReading = {
  skillId: string;
  mastery: number;
  evidence: number;
};

export type SkillClass = 'STRONG' | 'WEAK' | 'NEUTRAL' | 'UNKNOWN';

export function classifySkill(reading: SkillReading): SkillClass {
  const { strong, weak } = PROFILE_RULES;

  if (
    reading.mastery >= strong.minMastery &&
    reading.evidence >= strong.minEvidence
  ) {
    return 'STRONG';
  }

  if (
    reading.mastery < weak.maxMastery &&
    reading.evidence >= weak.minEvidence
  ) {
    return 'WEAK';
  }

  return reading.evidence < PROFILE_RULES.sufficientEvidence
    ? 'UNKNOWN'
    : 'NEUTRAL';
}

export type Weakness = {
  skillId: string;
  /** Por que é fraco: mastery baixa, erro recorrente ligado, ou os dois. */
  reasons: ('LOW_MASTERY' | 'RECURRING_ERROR')[];
  errorPatternIds: string[];
};

/**
 * Pontos fracos: skill com mastery baixa **ou** ligada a um erro recorrente.
 *
 * O erro recorrente marca as skills ligadas a ele na taxonomia que o aluno
 * já praticou — marcar skill que ele nunca viu seria acusar sem prova.
 */
export function findWeaknesses(input: {
  readings: readonly SkillReading[];
  recurringErrorIds: readonly string[];
  /** ErrorPattern → skills ligadas na taxonomia. */
  skillsByErrorPattern: ReadonlyMap<string, readonly string[]>;
}): Weakness[] {
  const practiced = new Set(
    input.readings
      .filter((reading) => reading.evidence > 0)
      .map((reading) => reading.skillId),
  );
  const bySkill = new Map<string, Weakness>();

  const touch = (skillId: string): Weakness => {
    const existing = bySkill.get(skillId);
    if (existing !== undefined) return existing;
    const created: Weakness = { skillId, reasons: [], errorPatternIds: [] };
    bySkill.set(skillId, created);
    return created;
  };

  for (const reading of input.readings) {
    if (classifySkill(reading) === 'WEAK') {
      touch(reading.skillId).reasons.push('LOW_MASTERY');
    }
  }

  for (const errorId of [...input.recurringErrorIds].sort()) {
    for (const skillId of input.skillsByErrorPattern.get(errorId) ?? []) {
      if (!practiced.has(skillId)) continue;
      const weakness = touch(skillId);
      if (!weakness.reasons.includes('RECURRING_ERROR')) {
        weakness.reasons.push('RECURRING_ERROR');
      }
      weakness.errorPatternIds.push(errorId);
    }
  }

  return [...bySkill.values()].sort((a, b) =>
    a.skillId.localeCompare(b.skillId),
  );
}

export function findStrengths(readings: readonly SkillReading[]): string[] {
  return readings
    .filter((reading) => classifySkill(reading) === 'STRONG')
    .sort((a, b) => b.mastery - a.mastery || a.skillId.localeCompare(b.skillId))
    .map((reading) => reading.skillId);
}

export type NeedCandidate = {
  skillId: string;
  cefrLevel: CefrLevel;
  goals: readonly LearningGoal[];
  requiredByCount: number;
};

export type Need = { skillId: string; priority: number; weak: boolean };

/**
 * O que estudar agora, em ordem.
 *
 * Entram as skills do nível atual e do próximo que ainda não têm evidência
 * suficiente, **mais** os pontos fracos (qualquer nível — fraqueza não
 * espera o aluno mudar de faixa). Forte nunca entra.
 *
 * prioridade = pré-requisito de muitas + fraqueza + ligação com objetivo
 *              + bônus do nível atual
 */
export function rankNeeds(input: {
  skills: readonly NeedCandidate[];
  readings: ReadonlyMap<string, SkillReading>;
  weakSkillIds: ReadonlySet<string>;
  currentLevel: CefrLevel;
  nextLevel: CefrLevel;
  goals: readonly LearningGoal[];
}): Need[] {
  const maxRequiredBy = Math.max(
    1,
    ...input.skills.map((skill) => skill.requiredByCount),
  );
  const goals = new Set(input.goals);

  return input.skills
    .flatMap((skill): Need[] => {
      const reading = input.readings.get(skill.skillId);
      const weak = input.weakSkillIds.has(skill.skillId);
      const inLevel =
        skill.cefrLevel === input.currentLevel ||
        skill.cefrLevel === input.nextLevel;
      const lacksEvidence =
        (reading?.evidence ?? 0) < PROFILE_RULES.sufficientEvidence;

      if (reading !== undefined && classifySkill(reading) === 'STRONG')
        return [];
      if (!weak && !(inLevel && lacksEvidence)) return [];

      const priority =
        NEED_WEIGHTS.prerequisite * (skill.requiredByCount / maxRequiredBy) +
        (weak ? NEED_WEIGHTS.weakness : 0) +
        (skill.goals.some((goal) => goals.has(goal)) ? NEED_WEIGHTS.goal : 0) +
        (skill.cefrLevel === input.currentLevel
          ? NEED_WEIGHTS.currentLevel
          : 0);

      return [
        {
          skillId: skill.skillId,
          priority: Math.round(priority * 1000) / 1000,
          weak,
        },
      ];
    })
    .sort(
      (a, b) => b.priority - a.priority || a.skillId.localeCompare(b.skillId),
    );
}
