import type {
  CefrLevel,
  Competency,
  LearningGoal,
  SelfReportedLevel,
} from '@english-saas/shared';

import {
  levelsByCompetency,
  nextLevel,
  overallLevel,
  type CompetencyLevel,
  type OverallLevel,
} from './competency-level';
import {
  isRecurring,
  recentOccurrences,
  type ErrorState,
} from './error-profile';
import { decayedTheta, masteryOf, type SkillState } from './mastery';
import {
  placementPseudoEvidence,
  type PlacementPrior,
} from './placement-prior';
import {
  findStrengths,
  findWeaknesses,
  PROFILE_RULES,
  rankNeeds,
  type Need,
  type SkillReading,
  type Weakness,
} from './profile';

/**
 * O modelo do aluno montado, a partir do que está gravado.
 *
 * Função pura: recebe estados, grafo de skills e perfil; devolve níveis,
 * fortes, fracos e necessidades. O snapshot da IA e o perfil do aluno são
 * projeções disto — os dois leem o mesmo cálculo, então não divergem.
 */

export type GraphSkill = {
  id: string;
  title: string;
  competency: Competency;
  cefrLevel: CefrLevel;
  goals: readonly LearningGoal[];
  requiredByCount: number;
  errorPatternIds: readonly string[];
};

export type ErrorPatternInfo = {
  id: string;
  description: string;
  correction: string;
  explanation: string;
};

export type ModelInput = {
  now: Date;
  graph: readonly GraphSkill[];
  skillStates: ReadonlyMap<string, SkillState>;
  errorStates: ReadonlyMap<string, ErrorState>;
  errorPatterns: readonly ErrorPatternInfo[];
  goals: readonly LearningGoal[];
  selfReportedLevel: SelfReportedLevel | null;
  /** Resultado do nivelamento (8), quando o aluno já fez. */
  placementPrior?: PlacementPrior | null;
};

export type SkillView = SkillReading & {
  title: string;
  competency: Competency;
  cefrLevel: CefrLevel;
  theta: number;
};

export type RecurringError = ErrorPatternInfo & {
  recentOccurrences: number;
  totalOccurrences: number;
  examples: { text: string; correction: string | null }[];
};

export type LearnerModel = {
  overall: OverallLevel;
  levels: Record<Competency, CompetencyLevel>;
  skills: SkillView[];
  strengths: SkillView[];
  weaknesses: (Weakness & { skill: SkillView | null })[];
  recurringErrors: RecurringError[];
  needs: (Need & { skill: GraphSkill })[];
};

export function buildLearnerModel(input: ModelInput): LearnerModel {
  const graph = new Map(input.graph.map((skill) => [skill.id, skill]));

  // Estado de skill que saiu da taxonomia (descontinuada) fica guardado,
  // mas não entra na conta: não se sabe mais a que competência pertence.
  const skills: SkillView[] = [...input.skillStates.entries()]
    .flatMap(([skillId, state]) => {
      const node = graph.get(skillId);
      if (node === undefined) return [];

      return [
        {
          skillId,
          title: node.title,
          competency: node.competency,
          cefrLevel: node.cefrLevel,
          theta: round(decayedTheta(state, input.now)),
          mastery: round(masteryOf(state, node.cefrLevel, input.now)),
          evidence: state.evidenceCount,
        },
      ];
    })
    .sort((a, b) => a.skillId.localeCompare(b.skillId));

  // O nivelamento entra como pseudo-skill de peso fixo em cada competência
  // que mediu: dá confiança média de saída e dilui com a prática real.
  const levels = levelsByCompetency([
    ...skills,
    ...placementPseudoEvidence(input.placementPrior ?? null),
  ]);
  const overall = overallLevel(levels, input.selfReportedLevel);
  const bySkill = new Map(skills.map((skill) => [skill.skillId, skill]));

  const skillsByErrorPattern = new Map<string, string[]>();
  for (const node of input.graph) {
    for (const errorId of node.errorPatternIds) {
      skillsByErrorPattern.set(errorId, [
        ...(skillsByErrorPattern.get(errorId) ?? []),
        node.id,
      ]);
    }
  }

  const info = new Map(
    input.errorPatterns.map((pattern) => [pattern.id, pattern]),
  );
  const recurringErrors: RecurringError[] = [...input.errorStates.entries()]
    .filter(([, state]) => isRecurring(state))
    .flatMap(([id, state]) => {
      const pattern = info.get(id);
      if (pattern === undefined) return [];

      return [
        {
          ...pattern,
          recentOccurrences: recentOccurrences(state),
          totalOccurrences: state.totalOccurrences,
          examples: [...state.examples].reverse().map((example) => ({
            text: example.text,
            correction: example.correction,
          })),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.recentOccurrences - a.recentOccurrences || a.id.localeCompare(b.id),
    );

  const weaknesses = findWeaknesses({
    readings: skills,
    recurringErrorIds: recurringErrors.map((error) => error.id),
    skillsByErrorPattern,
  }).map((weakness) => ({
    ...weakness,
    skill: bySkill.get(weakness.skillId) ?? null,
  }));

  const needs = rankNeeds({
    skills: input.graph.map((node) => ({
      skillId: node.id,
      cefrLevel: node.cefrLevel,
      goals: node.goals,
      requiredByCount: node.requiredByCount,
    })),
    readings: bySkill,
    weakSkillIds: new Set(weaknesses.map((weakness) => weakness.skillId)),
    currentLevel: overall.level,
    nextLevel: nextLevel(overall.level),
    goals: input.goals,
  }).flatMap((need) => {
    const skill = graph.get(need.skillId);
    return skill === undefined ? [] : [{ ...need, skill }];
  });

  return {
    overall,
    levels,
    skills,
    strengths: findStrengths(skills).flatMap((id) => {
      const skill = bySkill.get(id);
      return skill === undefined ? [] : [skill];
    }),
    weaknesses,
    recurringErrors,
    needs,
  };
}

/** As próximas skills-alvo: o topo das necessidades. */
export function nextTargets(model: LearnerModel): LearnerModel['needs'] {
  return model.needs.slice(0, PROFILE_RULES.maxTargets);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
