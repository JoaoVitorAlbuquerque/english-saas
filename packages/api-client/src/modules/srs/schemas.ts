import { answerResponseSchema } from '@english-saas/shared';
import { z } from 'zod';

import { answerResultSchema } from '../answers/schemas';
import { studentItemViewSchema } from '../lesson/schemas';

const REVIEW_CARD_KINDS = [
  'SKILL',
  'VOCAB',
  'CHUNK',
  'REGISTER_NOTE',
  'ERROR_PATTERN',
  'TERM',
] as const;

const FSRS_RATINGS = ['AGAIN', 'HARD', 'GOOD', 'EASY'] as const;
const REVIEW_CARD_STATES = ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'] as const;

/**
 * O exercício de um card de revisão. SKILL usa uma questão real (mesmo
 * `StudentItem` do catálogo, sem gabarito); os outros quatro tipos viram um
 * flashcard simples — frente/verso, auto-avaliado.
 */
export const sessionExerciseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ITEM'),
    item: studentItemViewSchema,
  }),
  z.object({
    type: z.literal('FLASHCARD'),
    front: z.string(),
    back: z.string(),
  }),
]);
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;

export const sessionCardSchema = z.object({
  cardId: z.string(),
  kind: z.enum(REVIEW_CARD_KINDS),
  due: z.string(),
  exercise: sessionExerciseSchema,
});
export type SessionCard = z.infer<typeof sessionCardSchema>;

export const reviewSessionSchema = z.array(sessionCardSchema);

/**
 * Corpo de `POST /reviews/:cardId/answer`: card de SKILL manda `ITEM`
 * (questão real, corrigida pelo learning); os outros mandam `SELF_RATING`
 * (o aluno se auto-avalia, sem gabarito por trás).
 */
export const reviewAnswerRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ITEM'),
    itemId: z.string(),
    response: answerResponseSchema,
    responseTimeMs: z.number().int().min(0),
    hintsUsed: z.number().int().min(0).optional(),
    clientAnswerId: z.string().min(8).max(64).optional(),
  }),
  z.object({
    kind: z.literal('SELF_RATING'),
    selfRating: z.enum(FSRS_RATINGS),
  }),
]);
export type ReviewAnswerRequest = z.infer<typeof reviewAnswerRequestSchema>;

export const reviewAnswerResultSchema = z.object({
  cardId: z.string(),
  rating: z.enum(FSRS_RATINGS),
  nextDueAt: z.string(),
  state: z.enum(REVIEW_CARD_STATES),
  /** Só em card de SKILL — gabarito, explicação e erros típicos completos. */
  answer: answerResultSchema.optional(),
});
export type ReviewAnswerResult = z.infer<typeof reviewAnswerResultSchema>;
