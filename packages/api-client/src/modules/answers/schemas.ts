import { answerResponseSchema } from '@english-saas/shared';
import { z } from 'zod';

const ANSWER_VERDICTS = ['CORRECT', 'PARTIAL', 'INCORRECT'] as const;

export const correctAnswerViewSchema = z.union([
  z.object({ optionIds: z.array(z.string()), texts: z.array(z.string()) }),
  z.object({ text: z.string() }),
  z.object({
    pairs: z.array(z.object({ left: z.string(), right: z.string() })),
  }),
]);
export type CorrectAnswerView = z.infer<typeof correctAnswerViewSchema>;

export const itemErrorPatternSchema = z.object({
  id: z.string(),
  description: z.string(),
  correction: z.string(),
  explanation: z.string(),
});

export const answerResultSchema = z.object({
  answerId: z.string(),
  isCorrect: z.boolean(),
  score: z.number(),
  verdict: z.enum(ANSWER_VERDICTS),
  feedback: z.string(),
  explanation: z.string(),
  correctAnswer: correctAnswerViewSchema,
  errorPatterns: z.array(itemErrorPatternSchema),
  isFirstTry: z.boolean(),
});
export type AnswerResult = z.infer<typeof answerResultSchema>;

/**
 * `POST /answers` — os três contextos que o aluno pode declarar (o servidor
 * grava PLACEMENT/CHECKPOINT/GENERATED_MATERIAL por conta própria). LESSON é
 * o único que leva `attemptId`; REVIEW e TARGETED_PRACTICE (prática de ponto
 * fraco da agenda, planner/10) não levam.
 */
const baseAnswerRequestSchema = z.object({
  itemId: z.string(),
  response: answerResponseSchema,
  responseTimeMs: z.number().int().min(0),
  hintsUsed: z.number().int().min(0).default(0),
  clientAnswerId: z.string().min(8).max(64).optional(),
});

export const submitAnswerRequestSchema = z.discriminatedUnion('context', [
  baseAnswerRequestSchema.extend({
    context: z.literal('LESSON'),
    attemptId: z.string(),
  }),
  baseAnswerRequestSchema.extend({ context: z.literal('REVIEW') }),
  baseAnswerRequestSchema.extend({ context: z.literal('TARGETED_PRACTICE') }),
]);
export type SubmitAnswerRequest = z.infer<typeof submitAnswerRequestSchema>;
