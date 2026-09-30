import { cefrLevelSchema } from '@english-saas/shared';
import { z } from 'zod';

import { resolvedAssetSchema } from '../lesson/schemas';

/**
 * Espelha `apps/api/src/modules/curriculum/{services/catalog.service.ts,
 * services/catalog-access.service.ts}` — o catálogo do aluno (módulo 4), com
 * `locked`/`requiredPlan` decorados pela política de acesso do billing (11).
 */

export const requiredPlanSchema = z.enum(['BASE', 'PLUS']);
export type RequiredPlan = z.infer<typeof requiredPlanSchema>;

const lockSchema = z.object({
  locked: z.boolean(),
  requiredPlan: requiredPlanSchema.nullable(),
});

export const catalogLevelSchema = z.object({
  id: z.string(),
  cefrLevel: cefrLevelSchema,
  title: z.string(),
  description: z.string().nullable(),
  objectives: z.array(z.string()),
  order: z.number(),
  course: z.object({
    slug: z.string(),
    title: z.string(),
    language: z.string(),
  }),
  unitCount: z.number(),
});
export type CatalogLevel = z.infer<typeof catalogLevelSchema>;

export const unitCastMemberSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatar: resolvedAssetSchema.nullable(),
});
export type UnitCastMember = z.infer<typeof unitCastMemberSchema>;

/** Lição dentro de uma unidade — nota o `publishedVersion` aninhado, como o backend devolve. */
export const unitLessonSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    order: z.number(),
    publishedVersion: z.object({
      version: z.number(),
      title: z.string(),
      objective: z.string(),
      cefrLevel: cefrLevelSchema,
      estimatedMinutes: z.number(),
    }),
  })
  .extend(lockSchema.shape);
export type UnitLesson = z.infer<typeof unitLessonSchema>;

export const catalogUnitSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    order: z.number(),
    title: z.string(),
    synopsis: z.string().nullable(),
    level: z.object({ cefrLevel: cefrLevelSchema, title: z.string() }),
    cover: resolvedAssetSchema.nullable(),
    cast: z.array(unitCastMemberSchema),
    lessons: z.array(unitLessonSchema),
  })
  .extend(lockSchema.shape);
export type CatalogUnit = z.infer<typeof catalogUnitSchema>;

export const paginatedUnitsSchema = z.object({
  data: z.array(catalogUnitSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type PaginatedUnits = z.infer<typeof paginatedUnitsSchema>;

export const catalogWorkbookSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    order: z.number(),
    unit: z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      level: z.object({ cefrLevel: cefrLevelSchema }),
    }),
    file: resolvedAssetSchema.nullable(),
  })
  .extend(lockSchema.shape);
export type CatalogWorkbook = z.infer<typeof catalogWorkbookSchema>;

export const workbookFileSchema = z.object({
  id: z.string(),
  file: resolvedAssetSchema,
});
export type WorkbookFile = z.infer<typeof workbookFileSchema>;
