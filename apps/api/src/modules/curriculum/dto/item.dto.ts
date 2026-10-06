import {
  cefrLevelSchema,
  contentStatusSchema,
  cursorPaginationQuerySchema,
  itemAuthoringPatchSchema,
  itemAuthoringSchema,
  itemTypeSchema,
  listedItemSourceSchema,
  taxonomySlugSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Entrada da autoria de questão.
 *
 * Os limites moram em `packages/shared` (`item-authoring.ts`), porque o editor
 * do admin confere os mesmos ao vivo. `content` entra como `unknown`: o schema
 * por tipo e a checagem do gabarito ficam em `validateItem` (também no shared).
 */

export class CreateItemDto extends createZodDto(itemAuthoringSchema) {}

export class UpdateItemDto extends createZodDto(itemAuthoringPatchSchema) {}

export class ItemListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    status: contentStatusSchema.optional(),
    level: cefrLevelSchema.optional(),
    skillId: taxonomySlugSchema.optional(),
    type: itemTypeSchema.optional(),
    source: listedItemSourceSchema.optional(),
    /** Busca no enunciado e no slug (sem diferença de caixa). */
    q: z.string().trim().min(1).max(80).optional(),
  }),
) {}
