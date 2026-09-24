import {
  cefrLevelSchema,
  competencySchema,
  cursorPaginationQuerySchema,
  registerLevelSchema,
  skillTypeSchema,
  taxonomySlugSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Entrada da autoria de taxonomia.
 *
 * O `id` só aparece na criação: slug de taxonomia não se renomeia (ver
 * `TaxonomyService`).
 */

export class CreateSkillDto extends createZodDto(
  z.object({
    id: taxonomySlugSchema,
    type: skillTypeSchema,
    competency: competencySchema,
    cefrLevel: cefrLevelSchema,
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1_000).nullable().optional(),
    prerequisites: z.array(taxonomySlugSchema).max(20).optional(),
    commonErrors: z.array(taxonomySlugSchema).max(20).optional(),
  }),
) {}

export class UpdateSkillDto extends createZodDto(
  z.object({
    type: skillTypeSchema.optional(),
    competency: competencySchema.optional(),
    cefrLevel: cefrLevelSchema.optional(),
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(1_000).nullable().optional(),
    prerequisites: z.array(taxonomySlugSchema).max(20).optional(),
    commonErrors: z.array(taxonomySlugSchema).max(20).optional(),
  }),
) {}

export class DeprecateDto extends createZodDto(
  z.object({ replacedById: taxonomySlugSchema.nullable().optional() }),
) {}

export class CreateErrorPatternDto extends createZodDto(
  z.object({
    id: taxonomySlugSchema,
    description: z.string().trim().min(4).max(500),
    example: z.string().trim().min(1).max(500),
    correction: z.string().trim().min(1).max(500),
    explanation: z.string().trim().min(4).max(2_000),
    skillIds: z.array(taxonomySlugSchema).max(20).optional(),
  }),
) {}

export class UpdateErrorPatternDto extends createZodDto(
  z.object({
    description: z.string().trim().min(4).max(500).optional(),
    example: z.string().trim().min(1).max(500).optional(),
    correction: z.string().trim().min(1).max(500).optional(),
    explanation: z.string().trim().min(4).max(2_000).optional(),
    skillIds: z.array(taxonomySlugSchema).max(20).optional(),
  }),
) {}

const registerNoteFields = {
  spokenForm: z.string().trim().min(1).max(300),
  standardForm: z.string().trim().min(1).max(300),
  register: registerLevelSchema,
  explanation: z.string().trim().min(4).max(2_000),
  whenToAvoid: z.string().trim().max(500).nullable().optional(),
  cefrLevel: cefrLevelSchema,
  skillId: taxonomySlugSchema.nullable().optional(),
  audioAssetId: z.uuid().nullable().optional(),
};

export class CreateRegisterNoteDto extends createZodDto(
  z.object({ id: taxonomySlugSchema, ...registerNoteFields }),
) {}

export class UpdateRegisterNoteDto extends createZodDto(
  z.object(registerNoteFields).partial(),
) {}

export class TaxonomyListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    includeDeprecated: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  }),
) {}
