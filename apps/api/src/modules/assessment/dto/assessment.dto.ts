import {
  answerResponseSchema,
  cefrLevelSchema,
  cursorPaginationQuerySchema,
  itemCalibrationFlagSchema,
  itemTypeSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Resposta a uma questão de prova. Sem dica: prova não tem dica. */
export class AssessmentAnswerDto extends createZodDto(
  z.object({
    itemId: z.uuid(),
    response: answerResponseSchema,
    responseTimeMs: z
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 1_000),
    clientAnswerId: z.string().min(8).max(64).optional(),
  }),
) {}

export class FlaggedItemsQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    flag: itemCalibrationFlagSchema.optional(),
    level: cefrLevelSchema.optional(),
    type: itemTypeSchema.optional(),
  }),
) {}
