import type { CefrLevel } from '@english-saas/shared';

import { typicalDifficulty } from 'src/modules/learner-model/domain/mastery';

import { estimateEap, probability, round } from './irt';
import { pickNearest } from './placement';

/**
 * Checkpoint de unidade: mini-prova adaptativa sobre as skills da unidade e
 * os pontos fracos conhecidos do aluno.
 *
 * É diagnóstico, nunca trava: o resultado diz o que reforçar, e o aluno
 * segue para onde quiser (CLAUDE.md → "Nada de bloquear conteúdo").
 */

export const CHECKPOINT_RULES = {
  minItems: 10,
  maxItems: 15,
  minPerTargetSkill: 2,
  /** Chance mínima numa questão típica da unidade para a skill "passar". */
  passP: 0.7,
  /** Acerto geral a partir do qual o resultado é "aprovado com reforço". */
  reinforceScore: 0.6,
  skillPriorSd: 1,
} as const;

export type CheckpointCandidate = {
  id: string;
  difficulty: number;
  exposureCount: number;
  skillIds: readonly string[];
};

export type CheckpointResponse = {
  difficulty: number;
  correct: boolean;
  skillIds: readonly string[];
};

function answeredFor(
  skillId: string,
  responses: readonly CheckpointResponse[],
) {
  return responses.filter((response) => response.skillIds.includes(skillId));
}

/**
 * Próxima questão: a skill com menos respostas até agora (as da unidade
 * antes das fracas, no empate), e dentro dela a questão mais perto do theta
 * atual da skill.
 */
export function nextCheckpointItem(input: {
  candidates: readonly CheckpointCandidate[];
  servedItemIds: ReadonlySet<string>;
  targetSkillIds: readonly string[];
  weakSkillIds: readonly string[];
  responses: readonly CheckpointResponse[];
  priorThetas: ReadonlyMap<string, number>;
  random: () => number;
}): { item: CheckpointCandidate; skillId: string } | null {
  const skills = [
    ...input.targetSkillIds,
    ...input.weakSkillIds.filter((id) => !input.targetSkillIds.includes(id)),
  ];
  const ordered = skills
    .map((skillId, order) => ({
      skillId,
      order,
      count: answeredFor(skillId, input.responses).length,
    }))
    .sort((a, b) => a.count - b.count || a.order - b.order);

  for (const { skillId } of ordered) {
    const pool = input.candidates.filter(
      (candidate) =>
        !input.servedItemIds.has(candidate.id) &&
        candidate.skillIds.includes(skillId),
    );

    if (pool.length === 0) {
      continue;
    }

    const theta = skillEstimate(
      skillId,
      input.responses,
      input.priorThetas,
    ).theta;
    const item = pickNearest(pool, theta, input.random);

    if (item !== null) {
      return { item, skillId };
    }
  }

  return null;
}

/** Mínimo de 10 com 2 por skill da unidade; máximo de 15; ou sem questão. */
export function checkpointShouldStop(input: {
  answered: number;
  targetSkillIds: readonly string[];
  responses: readonly CheckpointResponse[];
  hasNextItem: boolean;
}): boolean {
  if (input.answered >= CHECKPOINT_RULES.maxItems || !input.hasNextItem) {
    return true;
  }

  const covered = input.targetSkillIds.every(
    (skillId) =>
      answeredFor(skillId, input.responses).length >=
      CHECKPOINT_RULES.minPerTargetSkill,
  );

  return input.answered >= CHECKPOINT_RULES.minItems && covered;
}

function skillEstimate(
  skillId: string,
  responses: readonly CheckpointResponse[],
  priorThetas: ReadonlyMap<string, number>,
) {
  return estimateEap(answeredFor(skillId, responses), {
    mean: priorThetas.get(skillId) ?? 0,
    sd: CHECKPOINT_RULES.skillPriorSd,
  });
}

export type SkillOutcome = {
  theta: number;
  p: number;
  answered: number;
  correct: number;
};

export type CheckpointOutcome = {
  result: 'PASSED' | 'PASSED_WITH_REINFORCEMENT' | 'NEEDS_REINFORCEMENT';
  score: number;
  reinforceSkillIds: string[];
  skillResults: Record<string, SkillOutcome>;
};

/**
 * Resultado.
 *
 * - **PASSED**: toda skill medida tem chance ≥ 0.7 numa questão típica da
 *   unidade;
 * - **PASSED_WITH_REINFORCEMENT**: algumas abaixo, mas acerto geral ≥ 60%;
 * - **NEEDS_REINFORCEMENT**: o resto.
 *
 * Skill sem nenhuma questão respondida não entra na conta: sem medida, não
 * há o que dizer — nem que passou, nem que precisa de reforço.
 */
export function checkpointOutcome(input: {
  responses: readonly CheckpointResponse[];
  targetSkillIds: readonly string[];
  weakSkillIds: readonly string[];
  priorThetas: ReadonlyMap<string, number>;
  unitLevel: CefrLevel;
}): CheckpointOutcome {
  const skills = [...new Set([...input.targetSkillIds, ...input.weakSkillIds])];
  const typical = typicalDifficulty(input.unitLevel);
  const skillResults: Record<string, SkillOutcome> = {};

  for (const skillId of skills) {
    const own = answeredFor(skillId, input.responses);

    if (own.length === 0) {
      continue;
    }

    const estimate = skillEstimate(skillId, input.responses, input.priorThetas);

    skillResults[skillId] = {
      theta: estimate.theta,
      p: round(probability(estimate.theta, typical), 3),
      answered: own.length,
      correct: own.filter((response) => response.correct).length,
    };
  }

  const reinforceSkillIds = Object.entries(skillResults)
    .filter(([, outcome]) => outcome.p < CHECKPOINT_RULES.passP)
    .map(([skillId]) => skillId)
    .sort();

  const total = input.responses.length;
  const score =
    total === 0
      ? 0
      : round(
          input.responses.filter((response) => response.correct).length / total,
          3,
        );

  const result =
    reinforceSkillIds.length === 0
      ? 'PASSED'
      : score >= CHECKPOINT_RULES.reinforceScore
        ? 'PASSED_WITH_REINFORCEMENT'
        : 'NEEDS_REINFORCEMENT';

  return { result, score, reinforceSkillIds, skillResults };
}
