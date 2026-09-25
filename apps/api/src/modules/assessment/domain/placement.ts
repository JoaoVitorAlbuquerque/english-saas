import type {
  CefrLevel,
  Competency,
  SelfReportedLevel,
} from '@english-saas/shared';

import { thetaToLevel } from 'src/modules/learner-model/domain/competency-level';
import { typicalDifficulty } from 'src/modules/learner-model/domain/mastery';

import { estimateEap, probability, type Estimate } from './irt';

/**
 * Nivelamento adaptativo.
 *
 * A cada resposta, reestima theta e escolhe o próximo item perto dele,
 * alternando competências. Os parâmetros saíram de simulação (500 alunos
 * por faixa, banco sintético de −3 a +3): com priori de desvio 1.5 e
 * sorteio entre os 2 melhores, a faixa CEFR exata acerta 80–87% e ±1 faixa
 * acerta ≥ 99,8%. Com desvio 1 a priori puxava demais para o nível
 * declarado — o C1 caía para 65%.
 */

export const PLACEMENT_RULES = {
  minItems: 12,
  maxItems: 30,
  targetStandardError: 0.35,
  priorSd: 1.5,
  /** Sorteia entre os N melhores: controla exposição sem perder precisão. */
  randomesque: 2,
  /** Peso da exposição relativa na nota do item. */
  exposureWeight: 0.3,
  /** O theta da competência é puxado para o geral com este desvio. */
  competencyPriorSd: 0.5,
  /** Chance de acerto na dificuldade típica para contar como dominada. */
  masteredP: 0.8,
  retakeDays: 60,
} as const;

/** As competências que um item objetivo mede. Escrita e fala ficam de fora. */
export const PLACEMENT_COMPETENCIES = [
  'GRAMMAR',
  'VOCABULARY',
  'READING',
  'LISTENING',
] as const satisfies readonly Competency[];

const SELF_REPORTED_START: Record<SelfReportedLevel, CefrLevel> = {
  NONE: 'A1',
  BASIC: 'A2',
  INTERMEDIATE: 'B1',
  ADVANCED: 'B2',
};

export function startLevelFor(
  selfReported: SelfReportedLevel | null,
): CefrLevel {
  return selfReported === null ? 'A1' : SELF_REPORTED_START[selfReported];
}

export type PlacementCandidate = {
  id: string;
  difficulty: number;
  competency: Competency;
  exposureCount: number;
};

export type PlacementResponse = {
  difficulty: number;
  correct: boolean;
  competency: Competency;
};

export function currentEstimate(
  responses: readonly PlacementResponse[],
  startLevel: CefrLevel,
): Estimate {
  return estimateEap(responses, {
    mean: typicalDifficulty(startLevel),
    sd: PLACEMENT_RULES.priorSd,
  });
}

/**
 * Próximo item: a competência da vez (rodízio, pulando a que não tem item),
 * e dentro dela o que minimiza `|b − theta| + 0.3 · exposição relativa`,
 * sorteado entre os dois melhores.
 *
 * `random` entra por parâmetro — `domain/` não sorteia sozinho.
 */
export function nextPlacementItem(input: {
  candidates: readonly PlacementCandidate[];
  servedItemIds: ReadonlySet<string>;
  theta: number;
  answered: number;
  random: () => number;
}): PlacementCandidate | null {
  const available = input.candidates.filter(
    (candidate) => !input.servedItemIds.has(candidate.id),
  );

  for (let offset = 0; offset < PLACEMENT_COMPETENCIES.length; offset += 1) {
    const competency =
      PLACEMENT_COMPETENCIES[
        (input.answered + offset) % PLACEMENT_COMPETENCIES.length
      ];
    const pool = available.filter(
      (candidate) => candidate.competency === competency,
    );

    if (pool.length > 0) {
      return pickNearest(pool, input.theta, input.random);
    }
  }

  return null;
}

export function pickNearest<
  T extends { id: string; difficulty: number; exposureCount: number },
>(
  pool: readonly T[],
  target: number,
  random: () => number,
  top: number = PLACEMENT_RULES.randomesque,
): T | null {
  if (pool.length === 0) {
    return null;
  }

  const maxExposure = Math.max(1, ...pool.map((item) => item.exposureCount));
  const ranked = [...pool].sort(
    (a, b) =>
      score(a, target, maxExposure) - score(b, target, maxExposure) ||
      a.id.localeCompare(b.id),
  );
  const index = Math.min(Math.floor(random() * top), ranked.length - 1);

  return ranked[index] ?? null;
}

function score(
  item: { difficulty: number; exposureCount: number },
  target: number,
  maxExposure: number,
): number {
  return (
    Math.abs(item.difficulty - target) +
    PLACEMENT_RULES.exposureWeight * (item.exposureCount / maxExposure)
  );
}

export type StopReason = 'PRECISION' | 'MAX_ITEMS' | 'BANK_EXHAUSTED';

/** Mínimo de 12; para com erro padrão < 0.35, com 30 itens ou sem item. */
export function stopReason(input: {
  answered: number;
  standardError: number;
  hasNextItem: boolean;
}): StopReason | null {
  if (input.answered >= PLACEMENT_RULES.maxItems) {
    return 'MAX_ITEMS';
  }

  if (!input.hasNextItem) {
    return 'BANK_EXHAUSTED';
  }

  if (
    input.answered >= PLACEMENT_RULES.minItems &&
    input.standardError < PLACEMENT_RULES.targetStandardError
  ) {
    return 'PRECISION';
  }

  return null;
}

export type CompetencyResult = {
  theta: number;
  standardError: number;
  level: CefrLevel;
  items: number;
};

export type PlacementResult = {
  theta: number;
  standardError: number;
  overallLevel: CefrLevel;
  levelsByCompetency: Partial<Record<Competency, CompetencyResult>>;
  masteredSkillIds: string[];
};

/**
 * Resultado final.
 *
 * O theta de cada competência é estimado **puxado para o geral**
 * (priori N(geral, 0.5²)): com ~7 itens por competência, estimar cada uma
 * sozinha daria níveis que pulam de faixa por acaso. Competência sem item
 * não aparece — escrita e fala não são medidas aqui.
 *
 * Dominadas: skills com chance ≥ 0.8 numa questão típica do nível delas,
 * dado o theta da competência (ou o geral, se ela não foi medida).
 */
export function placementResult(input: {
  responses: readonly PlacementResponse[];
  startLevel: CefrLevel;
  skills: readonly {
    id: string;
    competency: Competency;
    cefrLevel: CefrLevel;
  }[];
}): PlacementResult {
  const overall = currentEstimate(input.responses, input.startLevel);
  const levelsByCompetency: Partial<Record<Competency, CompetencyResult>> = {};

  for (const competency of PLACEMENT_COMPETENCIES) {
    const own = input.responses.filter(
      (response) => response.competency === competency,
    );

    if (own.length === 0) {
      continue;
    }

    const estimate = estimateEap(own, {
      mean: overall.theta,
      sd: PLACEMENT_RULES.competencyPriorSd,
    });

    levelsByCompetency[competency] = {
      theta: estimate.theta,
      standardError: estimate.standardError,
      level: thetaToLevel(estimate.theta),
      items: own.length,
    };
  }

  const masteredSkillIds = input.skills
    .filter((skill) => {
      const theta =
        levelsByCompetency[skill.competency]?.theta ?? overall.theta;
      return (
        probability(theta, typicalDifficulty(skill.cefrLevel)) >=
        PLACEMENT_RULES.masteredP
      );
    })
    .map((skill) => skill.id)
    .sort();

  return {
    theta: overall.theta,
    standardError: overall.standardError,
    overallLevel: thetaToLevel(overall.theta),
    levelsByCompetency,
    masteredSkillIds,
  };
}

/** Quando o aluno pode refazer: 60 dias depois do último concluído. */
export function retakeAvailableAt(lastCompletedAt: Date | null): Date | null {
  if (lastCompletedAt === null) {
    return null;
  }

  return new Date(
    lastCompletedAt.getTime() + PLACEMENT_RULES.retakeDays * 86_400_000,
  );
}

export function canRetake(lastCompletedAt: Date | null, now: Date): boolean {
  const available = retakeAvailableAt(lastCompletedAt);
  return available === null || now.getTime() >= available.getTime();
}
