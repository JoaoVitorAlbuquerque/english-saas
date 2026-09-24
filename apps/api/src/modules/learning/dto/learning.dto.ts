import {
  STUDENT_ANSWER_CONTEXTS,
  answerResponseSchema,
  lessonAttemptSourceSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Entrada do player da lição. */

export class StartAttemptDto extends createZodDto(
  z.object({
    source: lessonAttemptSourceSchema.default('FREE_BROWSE'),
  }),
) {}

/** Uma etapa não leva mais que isso; acima, é aba esquecida aberta. */
const MAX_STEP_MS = 4 * 60 * 60 * 1_000;

export class CompleteStepDto extends createZodDto(
  z.object({
    timeSpentMs: z.number().int().min(0).max(MAX_STEP_MS).default(0),
    /**
     * Texto da produção livre. Só é guardado em etapa FREE_PRODUCTION; a
     * correção por IA vem com os módulos 7 e 12.
     */
    response: z
      .object({ text: z.string().trim().min(1).max(5_000) })
      .strict()
      .optional(),
  }),
) {}

export class SubmitAnswerDto extends createZodDto(
  z
    .object({
      itemId: z.uuid(),
      attemptId: z.uuid().optional(),
      context: z.enum(STUDENT_ANSWER_CONTEXTS),
      response: answerResponseSchema,
      responseTimeMs: z
        .number()
        .int()
        .min(0)
        .max(60 * 60 * 1_000),
      hintsUsed: z.number().int().min(0).max(20).default(0),
      /** Gerado pelo cliente. Reenviar a mesma resposta devolve a primeira. */
      clientAnswerId: z.string().min(8).max(64).optional(),
    })
    .refine(
      (body) => (body.context === 'LESSON') === (body.attemptId !== undefined),
      {
        message:
          'Resposta de lição precisa de `attemptId`; fora da lição, não mande `attemptId`.',
        path: ['attemptId'],
      },
    ),
) {}
