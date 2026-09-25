import type { Competency } from '@english-saas/shared';

import type { SkillState } from './mastery';

/**
 * O nivelamento (8) como ponto de partida do modelo.
 *
 * Três efeitos, todos daqui:
 *
 * 1. skill nova começa no theta da competência medida, não no fundo do
 *    nível dela — um aluno B1 não precisa de dez respostas para sair do
 *    chão numa skill A1;
 * 2. skill já praticada **pouco** (evidência < 4) é trazida para esse
 *    ponto: meia dúzia de respostas vale menos que um teste adaptativo;
 * 3. na agregação por competência, o nivelamento entra como pseudo-skill de
 *    peso 10 — confiança média logo de saída — e perde força sozinho
 *    conforme a prática real se acumula.
 *
 * Só as competências que o nivelamento mediu recebem pseudo-evidência.
 * Escrita e fala não são medidas por item objetivo: dar confiança a elas
 * seria inventar.
 */

export const PLACEMENT_PRIOR_WEIGHT = 10;
export const PLACEMENT_ADJUST_BELOW_EVIDENCE = 4;

export type PlacementPrior = {
  overallTheta: number;
  competencyThetas: Partial<Record<Competency, number>>;
};

export function priorThetaFor(
  prior: PlacementPrior,
  competency: Competency,
): number {
  return prior.competencyThetas[competency] ?? prior.overallTheta;
}

export function priorThetasBySkill(
  prior: PlacementPrior | null,
  skills: readonly { id: string; competency: Competency }[],
): Map<string, number> {
  if (prior === null) {
    return new Map();
  }

  return new Map(
    skills.map((skill) => [skill.id, priorThetaFor(prior, skill.competency)]),
  );
}

/** Estados pouco praticados trazidos para o ponto de partida. Só os que mudam. */
export function adjustToPlacement(
  states: ReadonlyMap<string, SkillState>,
  priorBySkill: ReadonlyMap<string, number>,
): Map<string, SkillState> {
  const changed = new Map<string, SkillState>();

  for (const [skillId, state] of states) {
    const prior = priorBySkill.get(skillId);

    if (
      prior !== undefined &&
      state.evidenceCount < PLACEMENT_ADJUST_BELOW_EVIDENCE &&
      state.theta !== prior
    ) {
      changed.set(skillId, { ...state, theta: prior });
    }
  }

  return changed;
}

/** As pseudo-skills que o nivelamento soma na agregação por competência. */
export function placementPseudoEvidence(
  prior: PlacementPrior | null,
): { competency: Competency; theta: number; evidence: number }[] {
  if (prior === null) {
    return [];
  }

  return (Object.entries(prior.competencyThetas) as [Competency, number][]).map(
    ([competency, theta]) => ({
      competency,
      theta,
      evidence: PLACEMENT_PRIOR_WEIGHT,
    }),
  );
}
