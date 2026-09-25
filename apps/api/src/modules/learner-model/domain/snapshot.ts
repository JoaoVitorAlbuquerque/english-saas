import {
  CEFR_LEVEL_LABELS,
  COMPETENCIES,
  COMPETENCY_LABELS,
  LEARNING_GOAL_LABELS,
  type CefrLevel,
  type Competency,
  type LearningGoal,
} from '@english-saas/shared';

import type { CompetencyLevel, Confidence } from './competency-level';
import { nextTargets, type LearnerModel } from './learner-model';

/**
 * As duas saídas do modelo do aluno.
 *
 * - **LearnerSnapshot**: o que a IA recebe. Compacto, com ids estáveis e
 *   ordem determinística — o mesmo aluno no mesmo estado gera o mesmo JSON,
 *   o que deixa o cache de IA funcionar.
 * - **StudentProfile**: o que o aluno vê, em pt-BR.
 *
 * Os exemplos reais de erro são **conteúdo do aluno**. Quem montar prompt
 * com o snapshot manda isso como dado não confiável, em mensagem separada
 * (CLAUDE.md → "Conteúdo do usuário é dado, nunca instrução").
 */

export const SNAPSHOT_VERSION = 1;

const SNAPSHOT_LIMITS = {
  strengths: 8,
  weakSkills: 8,
  errorPatterns: 5,
  interests: 5,
  recentTopics: 5,
} as const;

export type LearnerSnapshot = {
  version: number;
  overallLevel: { level: CefrLevel; source: string };
  levelsByCompetency: Record<
    Competency,
    { level: CefrLevel | null; confidence: Confidence }
  >;
  strengths: { skillId: string; title: string }[];
  weaknesses: {
    skills: { skillId: string; title: string; mastery: number }[];
    errorPatterns: {
      id: string;
      description: string;
      correction: string;
      recentOccurrences: number;
      examples: string[];
    }[];
  };
  nextTargetSkills: { skillId: string; title: string; level: CefrLevel }[];
  knownVocabularyLevel: CefrLevel;
  interests: { topic: string; weight: number }[];
  goals: LearningGoal[];
  recentTopics: string[];
};

export function buildSnapshot(input: {
  model: LearnerModel;
  interests: readonly { topic: string; weight: number }[];
  goals: readonly LearningGoal[];
  recentTopics: readonly string[];
}): LearnerSnapshot {
  const { model } = input;
  const vocabulary = model.levels.VOCABULARY;

  return {
    version: SNAPSHOT_VERSION,
    overallLevel: { level: model.overall.level, source: model.overall.source },
    levelsByCompetency: Object.fromEntries(
      COMPETENCIES.map((competency) => [
        competency,
        {
          level: model.levels[competency].level,
          confidence: model.levels[competency].confidence,
        },
      ]),
    ) as LearnerSnapshot['levelsByCompetency'],
    strengths: model.strengths
      .slice(0, SNAPSHOT_LIMITS.strengths)
      .map((skill) => ({ skillId: skill.skillId, title: skill.title })),
    weaknesses: {
      skills: model.weaknesses
        .flatMap((weakness) =>
          weakness.skill === null
            ? []
            : [
                {
                  skillId: weakness.skillId,
                  title: weakness.skill.title,
                  mastery: weakness.skill.mastery,
                },
              ],
        )
        .sort(
          (a, b) => a.mastery - b.mastery || a.skillId.localeCompare(b.skillId),
        )
        .slice(0, SNAPSHOT_LIMITS.weakSkills),
      errorPatterns: model.recurringErrors
        .slice(0, SNAPSHOT_LIMITS.errorPatterns)
        .map((error) => ({
          id: error.id,
          description: error.description,
          correction: error.correction,
          recentOccurrences: error.recentOccurrences,
          examples: error.examples.map((example) => example.text),
        })),
    },
    nextTargetSkills: nextTargets(model).map((need) => ({
      skillId: need.skillId,
      title: need.skill.title,
      level: need.skill.cefrLevel,
    })),
    // Sem evidência de vocabulário, o nível geral é o melhor palpite.
    knownVocabularyLevel:
      vocabulary.level !== null && vocabulary.confidence !== 'LOW'
        ? vocabulary.level
        : model.overall.level,
    interests: [...input.interests]
      .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic))
      .slice(0, SNAPSHOT_LIMITS.interests)
      .map((interest) => ({ topic: interest.topic, weight: interest.weight })),
    goals: [...input.goals].sort(),
    recentTopics: input.recentTopics.slice(0, SNAPSHOT_LIMITS.recentTopics),
  };
}

// ---------------------------------------------------------------------------
// O que o aluno vê
// ---------------------------------------------------------------------------

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  LOW: 'Ainda poucos dados',
  MEDIUM: 'Estimativa razoável',
  HIGH: 'Estimativa firme',
};

const SOURCE_NOTES: Record<LearnerModel['overall']['source'], string> = {
  MODEL: 'Calculado a partir das suas respostas.',
  SELF_REPORTED:
    'Por enquanto, é o nível que você informou no cadastro. Ele se ajusta conforme você pratica.',
  DEFAULT:
    'Ainda não temos dados seus. Começamos pelo A1 e ajustamos conforme você pratica.',
};

export type StudentProfile = {
  overallLevel: { level: CefrLevel; label: string; note: string };
  competencies: {
    competency: Competency;
    label: string;
    level: CefrLevel | null;
    confidence: string;
  }[];
  strengths: { skillId: string; title: string }[];
  weaknesses: { skillId: string; title: string; why: string }[];
  errors: {
    id: string;
    description: string;
    correction: string;
    explanation: string;
    occurrences: number;
    yourExamples: string[];
  }[];
  /** Erros que já apareceram, mas ainda não se repetem o bastante para serem fraqueza. */
  observedErrors: {
    id: string;
    description: string;
    correction: string;
    explanation: string;
    occurrences: number;
    yourExamples: string[];
  }[];
  needs: { skillId: string; title: string; level: CefrLevel; why: string }[];
  goals: { goal: LearningGoal; label: string }[];
};

function errorView(error: LearnerModel['recurringErrors'][number]) {
  return {
    id: error.id,
    description: error.description,
    correction: error.correction,
    explanation: error.explanation,
    occurrences: error.recentOccurrences,
    yourExamples: error.examples.map((example) => example.text),
  };
}

export function buildStudentProfile(input: {
  model: LearnerModel;
  goals: readonly LearningGoal[];
}): StudentProfile {
  const { model } = input;
  const errorsById = new Map(
    model.recurringErrors.map((error) => [error.id, error]),
  );

  return {
    overallLevel: {
      level: model.overall.level,
      label: CEFR_LEVEL_LABELS[model.overall.level],
      note: SOURCE_NOTES[model.overall.source],
    },
    competencies: COMPETENCIES.map((competency) => {
      const entry: CompetencyLevel = model.levels[competency];
      return {
        competency,
        label: COMPETENCY_LABELS[competency],
        level: entry.level,
        confidence: CONFIDENCE_LABELS[entry.confidence],
      };
    }),
    strengths: model.strengths.map((skill) => ({
      skillId: skill.skillId,
      title: skill.title,
    })),
    weaknesses: model.weaknesses.flatMap((weakness) => {
      if (weakness.skill === null) return [];

      const errors = weakness.errorPatternIds
        .map((id) => errorsById.get(id)?.description)
        .filter((text): text is string => text !== undefined);

      const why = weakness.reasons.includes('RECURRING_ERROR')
        ? `Um erro tem aparecido com frequência aqui: ${errors.join('; ')}`
        : 'Você tem errado mais do que acertado nesse ponto.';

      return [{ skillId: weakness.skillId, title: weakness.skill.title, why }];
    }),
    errors: model.recurringErrors.map(errorView),
    observedErrors: model.observedErrors.map(errorView),
    needs: nextTargets(model).map((need) => ({
      skillId: need.skillId,
      title: need.skill.title,
      level: need.skill.cefrLevel,
      why: need.weak
        ? 'Vale reforçar: é um ponto fraco seu agora.'
        : `Faz parte do ${need.skill.cefrLevel} e você ainda praticou pouco.`,
    })),
    goals: [...input.goals]
      .sort()
      .map((goal) => ({ goal, label: LEARNING_GOAL_LABELS[goal] })),
  };
}
