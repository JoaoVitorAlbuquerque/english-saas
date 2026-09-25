import { answerResponseSchema } from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ReviewSessionQueryDto extends createZodDto(
  z.object({
    minutes: z.coerce.number().int().min(1).max(120).default(10),
  }),
) {}

/**
 * Resposta a um card de revisão.
 *
 * `createZodDto` precisa de um único tipo objeto — um union de dois schemas
 * não dá uma classe com membros estáticos. Por isso um schema só, com `kind`
 * dizendo qual dos dois o corpo é: card de SKILL manda `ITEM` (questão real,
 * corrigida pelo learning); os outros mandam `SELF_RATING` (o aluno se
 * auto-avalia, sem gabarito por trás).
 */
const reviewAnswerSchema = z
  .object({
    kind: z.enum(['ITEM', 'SELF_RATING']),
    itemId: z.uuid().optional(),
    response: answerResponseSchema.optional(),
    responseTimeMs: z
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 1_000)
      .optional(),
    hintsUsed: z.number().int().min(0).max(10).optional(),
    clientAnswerId: z.string().min(8).max(64).optional(),
    selfRating: z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'ITEM') {
      if (data.itemId === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['itemId'],
          message: 'Obrigatório.',
        });
      }
      if (data.response === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['response'],
          message: 'Obrigatório.',
        });
      }
      if (data.responseTimeMs === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['responseTimeMs'],
          message: 'Obrigatório.',
        });
      }
      return;
    }

    if (data.selfRating === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['selfRating'],
        message: 'Obrigatório.',
      });
    }
  });

export class ReviewAnswerDto extends createZodDto(reviewAnswerSchema) {}
