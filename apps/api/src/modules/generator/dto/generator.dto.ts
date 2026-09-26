import { answerResponseSchema } from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Id gerado pelo cliente para reenviar sem duplicar em rede ruim. */
const clientRequestId = z.string().trim().min(1).max(80).optional();

export class SuggestTopicsDto extends createZodDto(
  z.object({
    interestText: z.string().trim().min(2).max(500),
    clientRequestId,
  }),
) {}

/**
 * Uma sugestão (`suggestionId`), um assunto digitado (`title`) ou
 * "surpreenda-me" (`surprise: true`) — exatamente um dos três. Objeto
 * único com `superRefine`: o `createZodDto` precisa de um objeto.
 */
export class GenerateTopicDto extends createZodDto(
  z
    .object({
      suggestionId: z.uuid().optional(),
      title: z.string().trim().min(2).max(160).optional(),
      surprise: z.literal(true).optional(),
      clientRequestId,
    })
    .superRefine((data, ctx) => {
      const given = [data.suggestionId, data.title, data.surprise].filter(
        (value) => value !== undefined,
      ).length;

      if (given !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['suggestionId'],
          message:
            'Escolha uma sugestão, digite um assunto ou peça para a gente escolher — um dos três.',
        });
      }
    }),
) {}

/** Texto colado, link, ou link + transcrição (rede social). */
export class IngestContentDto extends createZodDto(
  z
    .object({
      text: z.string().trim().min(1).max(40_000).optional(),
      url: z.string().trim().min(8).max(2_000).optional(),
      clientRequestId,
    })
    .refine((data) => data.text !== undefined || data.url !== undefined, {
      path: ['text'],
      message: 'Cole um texto ou mande um link.',
    }),
) {}

export class MaterialAnswerDto extends createZodDto(
  z.object({
    itemId: z.uuid(),
    response: answerResponseSchema,
    responseTimeMs: z
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 1_000),
    hintsUsed: z.number().int().min(0).max(20).default(0),
  }),
) {}

export class MaterialFeedbackDto extends createZodDto(
  z.object({
    rating: z.number().int().min(1).max(5),
    difficulty: z.enum(['TOO_EASY', 'OK', 'TOO_HARD']).optional(),
  }),
) {}
