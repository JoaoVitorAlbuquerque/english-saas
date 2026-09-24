import { z } from 'zod';

/**
 * Contratos do player da lição (módulo 6).
 *
 * A resposta do aluno tem um formato por **família** de item, e não por
 * tipo — o cliente já sabe o tipo, e o servidor confere se o formato bate
 * com o item de verdade antes de corrigir.
 *
 * | família   | tipos                                                   | resposta      |
 * | --------- | ------------------------------------------------------- | ------------- |
 * | escolha   | MULTIPLE_CHOICE, LISTEN_CHOOSE, READING_COMPREHENSION   | `{optionIds}` |
 * | digitado  | FILL_BLANK, TYPE_ANSWER, DICTATION, REGISTER_SWAP       | `{text}`      |
 * | ordenar   | ORDER_WORDS                                             | `{tokens}`    |
 * | ligar     | MATCH                                                   | `{pairs}`     |
 */

export const LESSON_ATTEMPT_STATUSES = [
  'IN_PROGRESS',
  'COMPLETED',
  'ABANDONED',
] as const;
export type LessonAttemptStatus = (typeof LESSON_ATTEMPT_STATUSES)[number];

export const LESSON_ATTEMPT_SOURCES = [
  'PLAN',
  'FREE_BROWSE',
  'REVIEW',
] as const;
export const lessonAttemptSourceSchema = z.enum(LESSON_ATTEMPT_SOURCES);
export type LessonAttemptSource = z.infer<typeof lessonAttemptSourceSchema>;

export const ANSWER_CONTEXTS = [
  'LESSON',
  'REVIEW',
  'PLACEMENT',
  'CHECKPOINT',
  'GENERATED_MATERIAL',
] as const;
export const answerContextSchema = z.enum(ANSWER_CONTEXTS);
export type AnswerContext = z.infer<typeof answerContextSchema>;

/**
 * Contextos que o aluno pode declarar pela rota HTTP. Os outros são
 * gravados pelo módulo dono (nivelamento, checkpoint, material gerado) —
 * o aluno não pode dizer "isto foi nivelamento".
 */
export const STUDENT_ANSWER_CONTEXTS = ['LESSON', 'REVIEW'] as const;

export const choiceResponseSchema = z
  .object({ optionIds: z.array(z.string().min(1).max(40)).min(1).max(6) })
  .strict();

export const textResponseSchema = z
  .object({ text: z.string().max(500) })
  .strict();

export const orderResponseSchema = z
  .object({ tokens: z.array(z.string().min(1).max(40)).min(1).max(20) })
  .strict();

export const matchResponseSchema = z
  .object({
    pairs: z
      .array(
        z.object({
          left: z.string().min(1).max(160),
          right: z.string().min(1).max(160),
        }),
      )
      .min(1)
      .max(8),
  })
  .strict();

/** `.strict()` em cada um: é o que deixa a união decidir sem ambiguidade. */
export const answerResponseSchema = z.union([
  choiceResponseSchema,
  textResponseSchema,
  orderResponseSchema,
  matchResponseSchema,
]);

export type ChoiceResponse = z.infer<typeof choiceResponseSchema>;
export type TextResponse = z.infer<typeof textResponseSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;
export type MatchResponse = z.infer<typeof matchResponseSchema>;
export type AnswerResponse = z.infer<typeof answerResponseSchema>;

export const ANSWER_VERDICTS = ['CORRECT', 'PARTIAL', 'INCORRECT'] as const;
export type AnswerVerdict = (typeof ANSWER_VERDICTS)[number];
