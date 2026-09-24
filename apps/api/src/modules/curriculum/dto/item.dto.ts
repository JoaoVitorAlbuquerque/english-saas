import {
  cefrLevelSchema,
  contentSlugSchema,
  contentStatusSchema,
  cursorPaginationQuerySchema,
  itemSourceSchema,
  itemTypeSchema,
  taxonomySlugSchema,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Entrada da autoria de questão.
 *
 * Como nas etapas de lição, `content` entra como `unknown`: o schema por
 * tipo e a checagem do gabarito ficam em `domain/item-rules.ts`.
 */

const itemFields = {
  slug: contentSlugSchema.nullable().optional(),
  type: itemTypeSchema,
  prompt: z.string().trim().min(2).max(1_000),
  content: z.unknown(),
  acceptedAnswers: z
    .array(z.string().trim().min(1).max(300))
    .max(20)
    .optional(),
  explanation: z.string().trim().min(2).max(2_000),
  errorPatternMap: z.record(z.string().min(1), taxonomySlugSchema).optional(),
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
};

export class CreateItemDto extends createZodDto(z.object(itemFields)) {}

export class UpdateItemDto extends createZodDto(
  z.object(itemFields).partial(),
) {}

export class ItemListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    status: contentStatusSchema.optional(),
    level: cefrLevelSchema.optional(),
    skillId: taxonomySlugSchema.optional(),
  }),
) {}
