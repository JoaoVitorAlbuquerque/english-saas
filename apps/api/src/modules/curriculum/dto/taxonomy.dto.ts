import {
  cefrLevelSchema,
  competencySchema,
  cursorPaginationQuerySchema,
  deprecateSchema,
  errorPatternAuthoringPatchSchema,
  errorPatternAuthoringSchema,
  registerLevelSchema,
  registerNoteAuthoringPatchSchema,
  registerNoteAuthoringSchema,
  skillAuthoringPatchSchema,
  skillAuthoringSchema,
  skillTypeSchema,
  taxonomySlugSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Entrada da autoria de taxonomia. Os limites moram em `packages/shared`
 * (`taxonomy-authoring.ts`), porque os formulários do admin conferem os
 * mesmos ao vivo.
 *
 * O `id` só aparece na criação: slug de taxonomia não se renomeia (ver
 * `TaxonomyService`).
 */

export class CreateSkillDto extends createZodDto(skillAuthoringSchema) {}

export class UpdateSkillDto extends createZodDto(skillAuthoringPatchSchema) {}

export class DeprecateDto extends createZodDto(deprecateSchema) {}

export class CreateErrorPatternDto extends createZodDto(
  errorPatternAuthoringSchema,
) {}

export class UpdateErrorPatternDto extends createZodDto(
  errorPatternAuthoringPatchSchema,
) {}

export class CreateRegisterNoteDto extends createZodDto(
  registerNoteAuthoringSchema,
) {}

export class UpdateRegisterNoteDto extends createZodDto(
  registerNoteAuthoringPatchSchema,
) {}

/** `includeDeprecated` chega como texto na query string. */
const includeDeprecatedSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/** Busca por texto, sem acento nem caixa (ver `domain/search.ts`). */
const searchSchema = z.string().trim().min(1).max(80).optional();

export class SkillListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    includeDeprecated: includeDeprecatedSchema,
    /** Busca por texto no id e no título. */
    q: searchSchema,
    level: cefrLevelSchema.optional(),
    competency: competencySchema.optional(),
    type: skillTypeSchema.optional(),
  }),
) {}

export class ErrorPatternListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    includeDeprecated: includeDeprecatedSchema,
    /** Busca no id, na descrição, no exemplo e na correção. */
    q: searchSchema,
    skillId: taxonomySlugSchema.optional(),
  }),
) {}

export class RegisterNoteListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    includeDeprecated: includeDeprecatedSchema,
    /** Busca no id e nas duas formas (falada e padrão). */
    q: searchSchema,
    level: cefrLevelSchema.optional(),
    register: registerLevelSchema.optional(),
    skillId: taxonomySlugSchema.optional(),
  }),
) {}
