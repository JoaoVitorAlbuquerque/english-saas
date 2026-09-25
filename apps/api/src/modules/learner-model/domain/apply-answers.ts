import type { CefrLevel } from '@english-saas/shared';

import {
  answerText,
  emptyErrorState,
  opportunitiesOf,
  recordOpportunity,
  type ErrorState,
} from './error-profile';
import {
  applyAnswer,
  initialSkillState,
  skillWeight,
  type SkillState,
} from './mastery';

/**
 * Aplica um lote de respostas, **em ordem**, aos estados do aluno.
 *
 * Duas regras de contagem, de propósito diferentes:
 *
 * - o **theta** só aprende com a primeira tentativa. A segunda resposta de
 *   quem acabou de ver o gabarito não mede habilidade;
 * - o **perfil de erro** conta tudo. O erro digitado na retentativa foi
 *   digitado.
 */

export type AnswerRecord = {
  id: string;
  itemId: string;
  isFirstTry: boolean;
  isCorrect: boolean;
  score: number;
  hintsUsed: number;
  detectedErrorPatterns: readonly string[];
  response: unknown;
  createdAt: Date;
};

export type ModelItem = {
  id: string;
  content: unknown;
  acceptedAnswers: readonly string[];
  errorPatternMap: Readonly<Record<string, string>>;
  difficulty: number;
  /** Em ordem: a primeira é a skill principal. */
  skillIds: readonly string[];
};

export type ApplyResult = {
  skillStates: Map<string, SkillState>;
  errorStates: Map<string, ErrorState>;
  touchedSkills: Set<string>;
  touchedErrors: Set<string>;
};

export function applyAnswers(input: {
  answers: readonly AnswerRecord[];
  items: ReadonlyMap<string, ModelItem>;
  skillLevels: ReadonlyMap<string, CefrLevel>;
  errorPatternsBySkill: ReadonlyMap<string, readonly string[]>;
  skillStates: ReadonlyMap<string, SkillState>;
  errorStates: ReadonlyMap<string, ErrorState>;
}): ApplyResult {
  const skillStates = new Map(input.skillStates);
  const errorStates = new Map(input.errorStates);
  const touchedSkills = new Set<string>();
  const touchedErrors = new Set<string>();

  for (const answer of input.answers) {
    const item = input.items.get(answer.itemId);

    if (item === undefined) {
      continue;
    }

    if (answer.isFirstTry) {
      item.skillIds.forEach((skillId, position) => {
        const level = input.skillLevels.get(skillId);

        // Skill fora da taxonomia atual: sem nível, não há ponto de partida.
        if (level === undefined) return;

        const current = skillStates.get(skillId) ?? initialSkillState(level);

        skillStates.set(
          skillId,
          applyAnswer(current, {
            difficulty: item.difficulty,
            score: answer.score,
            isCorrect: answer.isCorrect,
            hintsUsed: answer.hintsUsed,
            weight: skillWeight(position),
            at: answer.createdAt,
          }),
        );
        touchedSkills.add(skillId);
      });
    }

    const detected = new Set(answer.detectedErrorPatterns);
    const opportunities = new Set([
      ...opportunitiesOf(item, input.errorPatternsBySkill),
      ...detected,
    ]);

    for (const errorId of [...opportunities].sort()) {
      const hit = detected.has(errorId);
      const text = hit ? answerText(item.content, answer.response) : null;

      errorStates.set(
        errorId,
        recordOpportunity(errorStates.get(errorId) ?? emptyErrorState(), {
          hit,
          at: answer.createdAt,
          example:
            text === null
              ? undefined
              : {
                  text,
                  correction: correctionOf(item),
                  itemId: item.id,
                  at: answer.createdAt.toISOString(),
                },
        }),
      );
      touchedErrors.add(errorId);
    }
  }

  return { skillStates, errorStates, touchedSkills, touchedErrors };
}

/** A forma certa de um item, para acompanhar o exemplo errado. */
export function correctionOf(
  item: Pick<ModelItem, 'content' | 'acceptedAnswers'>,
): string | null {
  const accepted = item.acceptedAnswers[0];

  if (accepted !== undefined) {
    return accepted;
  }

  const content = item.content as {
    options?: { id?: unknown; text?: unknown }[];
    correctOptionIds?: unknown[];
  } | null;
  const correct = new Set(content?.correctOptionIds ?? []);
  const texts = (content?.options ?? [])
    .filter(
      (option) => correct.has(option.id) && typeof option.text === 'string',
    )
    .map((option) => option.text as string);

  return texts.length > 0 ? texts.join(' / ') : null;
}
