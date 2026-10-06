import { z } from 'zod';

import { cefrLevelSchema } from './cefr';
import {
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  contentSlugSchema,
  taxonomySlugSchema,
} from './curriculum';
import {
  errorPatternMapSchema,
  itemSourceSchema,
  itemTypeSchema,
} from './item-content';

/**
 * Campos editáveis de uma questão — os limites que a API aplica em
 * `POST/PATCH items` e que o editor do admin confere ao vivo.
 *
 * `content` entra como `unknown`: o schema por tipo e a checagem do gabarito
 * ficam em `item-validation.ts` (`validateItem`).
 */

/** Respostas digitadas aceitas (tipos ORDER_WORDS, FILL_BLANK, TYPE_ANSWER…). */
export const acceptedAnswersSchema = z
  .array(z.string().trim().min(1).max(300))
  .max(20);

export const itemAuthoringSchema = z.object({
  slug: contentSlugSchema.nullable().optional(),
  type: itemTypeSchema,
  prompt: z.string().trim().min(2).max(1_000),
  content: z.unknown(),
  acceptedAnswers: acceptedAnswersSchema.optional(),
  explanation: z.string().trim().min(2).max(2_000),
  errorPatternMap: errorPatternMapSchema.optional(),
  cefrLevel: cefrLevelSchema,
  difficulty: z
    .number()
    .min(MIN_DIFFICULTY)
    .max(MAX_DIFFICULTY)
    .nullable()
    .optional(),
  discrimination: z.number().min(0.1).max(3).optional(),
  skillIds: z.array(taxonomySlugSchema).min(1).max(10),
  source: itemSourceSchema.optional(),
});

export type ItemAuthoring = z.infer<typeof itemAuthoringSchema>;

/** Na API todo campo é opcional no `PATCH`: só vai o que mudou. */
export const itemAuthoringPatchSchema = itemAuthoringSchema.partial();
