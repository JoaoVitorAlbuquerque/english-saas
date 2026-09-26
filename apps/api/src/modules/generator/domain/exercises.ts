import type { AnswerResponse, ItemType } from '@english-saas/shared';

import {
  mapDraftItem,
  type DraftItem,
} from 'src/modules/content-studio/domain/draft-mapping';
import { validateItem } from 'src/modules/curriculum/domain/item-rules';
import {
  evaluateAnswer,
  responseShapeError,
} from 'src/modules/learning/domain/evaluate-answer';

/**
 * Exercícios de um material: questões no formato do banco (módulo 4),
 * conferidas com as mesmas regras e corrigidas pelo mesmo avaliador do
 * learning (6) antes de chegar ao aluno.
 *
 * A autocorreção é o teste que pega o erro mais comum de questão gerada:
 * gabarito que o próprio corretor não aceita (lacuna sem `___`, peças do
 * ORDER_WORDS que não formam a resposta, alternativa certa inexistente).
 */

export const EXERCISE_PURPOSES = [
  'COMPREHENSION',
  'TARGET_STRUCTURE',
  'REGISTER',
  'VOCABULARY',
] as const;

export type ExercisePurpose = (typeof EXERCISE_PURPOSES)[number];

/** Sem áudio: não há TTS no material gerado. */
export const GENERATED_ITEM_TYPES = [
  'MULTIPLE_CHOICE',
  'FILL_BLANK',
  'ORDER_WORDS',
  'TYPE_ANSWER',
  'REGISTER_SWAP',
] as const satisfies readonly ItemType[];

export type GeneratedExerciseDraft = DraftItem & { purpose: ExercisePurpose };

export type ValidExercise = {
  purpose: ExercisePurpose;
  type: ItemType;
  prompt: string;
  content: Record<string, unknown>;
  acceptedAnswers: string[];
  explanation: string;
  errorPatternMap: Record<string, string>;
  skillIds: string[];
};

export type ExerciseRefs = {
  /** Skills que o exercício pode medir: alvos, compreensão, vocabulário. */
  skillIds: ReadonlySet<string>;
  errorPatternIds: ReadonlySet<string>;
  registerNoteIds: ReadonlySet<string>;
};

export type ExerciseVerdict =
  { ok: true; exercise: ValidExercise } | { ok: false; reason: string };

export const MIN_EXERCISES = 4;
export const MAX_EXERCISES = 10;

/**
 * Valida um exercício. Id que a IA não recebeu sai (skill, erro típico) ou
 * derruba o exercício (nota de registro do REGISTER_SWAP, que é o próprio
 * assunto dele).
 */
export function validateExercise(
  draft: GeneratedExerciseDraft,
  refs: ExerciseRefs,
): ExerciseVerdict {
  if (!(GENERATED_ITEM_TYPES as readonly string[]).includes(draft.type)) {
    return { ok: false, reason: `tipo ${draft.type} não é gerado` };
  }

  const type = draft.type as ItemType;
  const skillIds = [...new Set(draft.skillIds)].filter((id) =>
    refs.skillIds.has(id),
  );

  if (skillIds.length === 0) {
    return { ok: false, reason: 'nenhuma skill conhecida' };
  }

  if (
    type === 'REGISTER_SWAP' &&
    (draft.registerNoteId == null ||
      !refs.registerNoteIds.has(draft.registerNoteId))
  ) {
    return { ok: false, reason: 'nota de registro desconhecida' };
  }

  const mapped = mapDraftItem({
    ...draft,
    // ORDER_WORDS: peças em ordem alfabética — a IA às vezes devolve já na
    // ordem certa, e isso entregaria a resposta.
    tokens:
      type === 'ORDER_WORDS' && draft.tokens != null
        ? [...draft.tokens].sort((a, b) => a.localeCompare(b))
        : (draft.tokens ?? null),
    errorPatterns: (draft.errorPatterns ?? []).filter((entry) =>
      refs.errorPatternIds.has(entry.errorPatternId),
    ),
    skillIds,
  });

  const issues = validateItem({
    type,
    content: mapped.content,
    acceptedAnswers: mapped.acceptedAnswers,
    errorPatternMap: mapped.errorPatternMap,
  });

  if (issues.length > 0) {
    return {
      ok: false,
      reason: issues.map((issue) => issue.message).join(' '),
    };
  }

  const item = {
    type,
    content: mapped.content,
    acceptedAnswers: mapped.acceptedAnswers,
    errorPatternMap: mapped.errorPatternMap,
  };
  const response = answerKeyResponse(item);

  if (
    response === null ||
    responseShapeError(item, response) !== null ||
    !evaluateAnswer(item, response).isCorrect
  ) {
    return { ok: false, reason: 'o gabarito não passa na própria correção' };
  }

  return {
    ok: true,
    exercise: {
      purpose: draft.purpose,
      type,
      prompt: mapped.prompt,
      content: mapped.content,
      acceptedAnswers: mapped.acceptedAnswers,
      explanation: mapped.explanation,
      errorPatternMap: mapped.errorPatternMap,
      skillIds,
    },
  };
}

/** A resposta que o gabarito daria — o que a autocorreção manda corrigir. */
export function answerKeyResponse(item: {
  type: ItemType;
  content: Record<string, unknown>;
  acceptedAnswers: readonly string[];
}): AnswerResponse | null {
  switch (item.type) {
    case 'MULTIPLE_CHOICE':
    case 'READING_COMPREHENSION':
    case 'LISTEN_CHOOSE': {
      const ids = item.content['correctOptionIds'];
      return Array.isArray(ids) && ids.every((id) => typeof id === 'string')
        ? { optionIds: ids }
        : null;
    }
    case 'ORDER_WORDS': {
      const answer = item.acceptedAnswers[0];
      const tokens = item.content['tokens'];

      if (answer === undefined || !Array.isArray(tokens)) {
        return null;
      }

      // As peças na ordem da resposta: cada palavra da resposta consome a
      // peça igual (ignorando caixa e pontuação da ponta).
      const pool = tokens.filter(
        (token): token is string => typeof token === 'string',
      );
      const ordered: string[] = [];

      for (const word of answer.split(/\s+/).filter(Boolean)) {
        const index = pool.findIndex((token) => sameWord(token, word));
        if (index === -1) return null;
        ordered.push(pool.splice(index, 1)[0] ?? '');
      }

      return pool.length === 0 ? { tokens: ordered } : null;
    }
    case 'FILL_BLANK':
    case 'TYPE_ANSWER':
    case 'DICTATION':
    case 'REGISTER_SWAP': {
      const answer = item.acceptedAnswers[0];
      return answer === undefined ? null : { text: answer };
    }
    case 'MATCH': {
      const pairs = item.content['pairs'];
      return Array.isArray(pairs)
        ? { pairs: pairs as { left: string; right: string }[] }
        : null;
    }
  }
}

/**
 * O conjunto serve? Pelo menos quatro exercícios, um de compreensão e um da
 * estrutura-alvo — é o que faz o material ser sobre o texto **e** sobre o
 * que o aluno precisa.
 */
export function exerciseMixIssues(
  exercises: readonly ValidExercise[],
  targetSkillIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];

  if (exercises.length < MIN_EXERCISES) {
    issues.push(
      `só ${String(exercises.length)} exercícios válidos (mínimo ${String(MIN_EXERCISES)})`,
    );
  }

  if (!exercises.some((exercise) => exercise.purpose === 'COMPREHENSION')) {
    issues.push('nenhum exercício de compreensão');
  }

  if (
    !exercises.some(
      (exercise) =>
        exercise.purpose === 'TARGET_STRUCTURE' &&
        exercise.skillIds.some((id) => targetSkillIds.has(id)),
    )
  ) {
    issues.push('nenhum exercício da estrutura-alvo');
  }

  return issues;
}

function sameWord(a: string, b: string): boolean {
  const clean = (value: string) =>
    value.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
  return clean(a) === clean(b);
}
