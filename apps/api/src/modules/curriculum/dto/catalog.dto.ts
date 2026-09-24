import {
  cefrLevelSchema,
  competencySchema,
  cursorPaginationQuerySchema,
  skillTypeSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Filtros das rotas públicas do catálogo. */

export class CatalogLevelQueryDto extends createZodDto(
  z.object({ level: cefrLevelSchema.optional() }),
) {}

export class CatalogUnitQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({ level: cefrLevelSchema.optional() }),
) {}

export class CatalogSkillQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    level: cefrLevelSchema.optional(),
    competency: competencySchema.optional(),
    type: skillTypeSchema.optional(),
  }),
) {}

export class CatalogRegisterNoteQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({ level: cefrLevelSchema.optional() }),
) {}
