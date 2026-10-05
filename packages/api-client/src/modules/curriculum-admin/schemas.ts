import {
  cefrLevelSchema,
  contentSlugSchema,
  contentStatusSchema,
  errorPatternSchema,
  itemTypeSchema,
  lessonStepTypeSchema,
  lessonVersionMetaSchema,
  registerNoteSchema,
  skillSchema,
  taxonomySlugSchema,
} from '@english-saas/shared';
import { z } from 'zod';

import {
  catalogLessonSchema,
  lessonItemSchema,
  resolvedAssetSchema,
} from '../lesson/schemas';

/**
 * Espelha `admin/curriculum/*` (módulo 4, só EDITOR/ADMIN): estrutura do
 * curso, lição versionada, elenco, taxonomia e banco de questões.
 *
 * A etapa chega como `{ order, type, content: unknown }`: o editor trabalha
 * com rascunho incompleto, então o `content` **não** passa pelo schema do
 * tipo aqui — quem valida é `validateSteps` (`packages/shared`).
 */

// ---------------------------------------------------------------------------
// Curso, nível, unidade, lição
// ---------------------------------------------------------------------------

export const adminLevelSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  cefrLevel: cefrLevelSchema,
  title: z.string(),
  description: z.string().nullable(),
  objectives: z.array(z.string()),
  order: z.number(),
});
export type AdminLevel = z.infer<typeof adminLevelSchema>;

export const adminCourseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  language: z.string(),
  description: z.string().nullable(),
  levels: z.array(adminLevelSchema),
});
export type AdminCourse = z.infer<typeof adminCourseSchema>;
export const adminCourseListSchema = z.array(adminCourseSchema);

export const adminCharacterSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  voiceId: z.string().nullable(),
  avatarAssetId: z.string().nullable(),
  /** URL assinada do avatar — só a listagem traz. */
  avatarUrl: z.string().nullable().optional(),
});
export type AdminCharacter = z.infer<typeof adminCharacterSchema>;
export const adminCharacterListSchema = z.array(adminCharacterSchema);

/** Lição como a unidade a lista: sem as versões. */
export const adminUnitLessonSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  slug: z.string(),
  order: z.number(),
  publishedVersionId: z.string().nullable(),
});

export const adminUnitSchema = z.object({
  id: z.string(),
  levelId: z.string(),
  slug: z.string(),
  order: z.number(),
  title: z.string(),
  synopsis: z.string().nullable(),
  status: contentStatusSchema,
  coverAssetId: z.string().nullable(),
  cast: z.array(z.object({ character: adminCharacterSchema })),
  lessons: z.array(adminUnitLessonSchema),
});
export type AdminUnit = z.infer<typeof adminUnitSchema>;
export const adminUnitListSchema = z.array(adminUnitSchema);

export const adminVersionSummarySchema = z.object({
  id: z.string(),
  version: z.number(),
  status: contentStatusSchema,
  title: z.string(),
  publishedAt: z.string().nullable(),
});
export type AdminVersionSummary = z.infer<typeof adminVersionSummarySchema>;

export const adminLessonSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  order: z.number(),
  unitId: z.string(),
  publishedVersionId: z.string().nullable(),
  versions: z.array(adminVersionSummarySchema),
});
export type AdminLessonSummary = z.infer<typeof adminLessonSummarySchema>;
export const adminLessonSummaryListSchema = z.array(adminLessonSummarySchema);

// ---------------------------------------------------------------------------
// Versão da lição
// ---------------------------------------------------------------------------

export const adminStepSchema = z.object({
  /** Só as etapas que vêm do servidor têm id. */
  id: z.string().optional(),
  order: z.number(),
  type: lessonStepTypeSchema,
  content: z.unknown(),
});
export type AdminStep = z.infer<typeof adminStepSchema>;

export const adminVersionSchema = z.object({
  id: z.string(),
  version: z.number(),
  status: contentStatusSchema,
  title: z.string(),
  objective: z.string(),
  cefrLevel: cefrLevelSchema,
  estimatedMinutes: z.number(),
  approvedAt: z.string().nullable(),
  approvedById: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lesson: z.object({
    id: z.string(),
    slug: z.string(),
    order: z.number(),
    unitId: z.string(),
  }),
  steps: z.array(adminStepSchema),
  targetSkills: z.array(
    z.object({ skillId: z.string(), position: z.number() }),
  ),
});
export type AdminVersion = z.infer<typeof adminVersionSchema>;

export const adminLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  order: z.number(),
  unitId: z.string(),
  publishedVersionId: z.string().nullable(),
  versions: z.array(adminVersionSchema),
});
export type AdminLesson = z.infer<typeof adminLessonSchema>;

/** Problema de uma etapa — a forma de `StepIssue` em `packages/shared`. */
export const stepIssueSchema = z.object({
  /** -1 quando o problema é da lição inteira. */
  order: z.number(),
  path: z.string(),
  message: z.string(),
});
export type StepIssueView = z.infer<typeof stepIssueSchema>;

/** Resposta do `PUT steps?draft=true`: a versão e o que a validação diria. */
export const draftSaveResultSchema = adminVersionSchema.extend({
  issues: z.array(stepIssueSchema),
});
export type DraftSaveResult = z.infer<typeof draftSaveResultSchema>;

export const saveVersionMetaRequestSchema = lessonVersionMetaSchema.partial();
export type SaveVersionMetaRequest = z.infer<
  typeof saveVersionMetaRequestSchema
>;

export const saveDraftStepsRequestSchema = z.object({
  steps: z
    .array(
      z.object({
        order: z.number().int().min(0),
        type: lessonStepTypeSchema,
        content: z.unknown(),
      }),
    )
    .max(40),
});
export type SaveDraftStepsRequest = z.infer<typeof saveDraftStepsRequestSchema>;

export const VERSION_ACTIONS = [
  'submit-for-review',
  'approve',
  'reject',
  'publish',
  'archive',
] as const;
export type VersionAction = (typeof VERSION_ACTIONS)[number];

export const UNIT_ACTIONS = [
  'submit',
  'approve',
  'reject',
  'publish',
  'archive',
] as const;
export type UnitAction = (typeof UNIT_ACTIONS)[number];

export const createLessonRequestSchema = z.object({
  unitId: z.string(),
  slug: contentSlugSchema,
  order: z.number().int().min(0),
  title: lessonVersionMetaSchema.shape.title,
  objective: lessonVersionMetaSchema.shape.objective,
  cefrLevel: cefrLevelSchema,
  estimatedMinutes: z.number().int().min(1).max(180).optional(),
  targetSkillIds: z.array(taxonomySlugSchema).max(20).optional(),
});
export type CreateLessonRequest = z.infer<typeof createLessonRequestSchema>;

export const createUnitRequestSchema = z.object({
  levelId: z.string(),
  slug: contentSlugSchema,
  order: z.number().int().min(0),
  title: z.string().trim().min(2).max(160),
  synopsis: z.string().trim().max(1_000).nullable().optional(),
  characterIds: z.array(z.string()).max(12).optional(),
});
export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>;

export const updateUnitRequestSchema = createUnitRequestSchema
  .omit({ levelId: true, slug: true })
  .partial();
export type UpdateUnitRequest = z.infer<typeof updateUnitRequestSchema>;

export const reorderUnitsRequestSchema = z.object({
  levelId: z.string(),
  ids: z.array(z.string()).min(1),
});
export const reorderLessonsRequestSchema = z.object({
  unitId: z.string(),
  ids: z.array(z.string()).min(1),
});

// ---------------------------------------------------------------------------
// Personagem e mídia
// ---------------------------------------------------------------------------

export const createCharacterRequestSchema = z.object({
  slug: contentSlugSchema,
  name: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(1_000).nullable().optional(),
  voiceId: z.string().trim().max(120).nullable().optional(),
  avatarAssetId: z.string().nullable().optional(),
});
export type CreateCharacterRequest = z.infer<
  typeof createCharacterRequestSchema
>;

export const updateCharacterRequestSchema = createCharacterRequestSchema
  .omit({ slug: true })
  .partial();
export type UpdateCharacterRequest = z.infer<
  typeof updateCharacterRequestSchema
>;

export const uploadedImageSchema = z.object({
  id: z.string(),
  kind: z.literal('IMAGE'),
  mimeType: z.string(),
  storageKey: z.string(),
  url: z.string(),
});
export type UploadedImage = z.infer<typeof uploadedImageSchema>;

// ---------------------------------------------------------------------------
// Taxonomia e banco de questões (só leitura, para o editor escolher)
// ---------------------------------------------------------------------------

function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

export const adminSkillPageSchema = paginated(skillSchema);
export type AdminSkillPage = z.infer<typeof adminSkillPageSchema>;
export type AdminSkill = AdminSkillPage['data'][number];

export const adminRegisterNotePageSchema = paginated(registerNoteSchema);
export type AdminRegisterNotePage = z.infer<typeof adminRegisterNotePageSchema>;
export type AdminRegisterNote = AdminRegisterNotePage['data'][number];

export const adminErrorPatternPageSchema = paginated(errorPatternSchema);
export type AdminErrorPatternPage = z.infer<typeof adminErrorPatternPageSchema>;
export type AdminErrorPattern = AdminErrorPatternPage['data'][number];

/** Item do banco, com o gabarito — só o editor vê. */
export const adminItemSchema = lessonItemSchema.extend({
  type: itemTypeSchema,
  slug: z.string().nullable(),
  acceptedAnswers: z.unknown(),
  explanation: z.string().nullable(),
  errorPatternMap: z.record(z.string(), z.string()),
  status: contentStatusSchema,
  source: z.string(),
  difficulty: z.number(),
});
export type AdminItem = z.infer<typeof adminItemSchema>;
export const adminItemPageSchema = paginated(adminItemSchema);
export type AdminItemPage = z.infer<typeof adminItemPageSchema>;

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * A lição como o aluno a vê (`GET lesson-versions/:id/preview`), mas com as
 * etapas soltas: rascunho pela metade não passa no schema do tipo, e o
 * preview mostra o aviso daquela etapa em vez de quebrar.
 */
export const lessonPreviewSchema = catalogLessonSchema
  .omit({ steps: true })
  .extend({
    steps: z.array(
      z.object({
        order: z.number(),
        type: lessonStepTypeSchema,
        content: z.unknown(),
      }),
    ),
    assets: z.record(z.string(), resolvedAssetSchema),
  });
export type LessonPreview = z.infer<typeof lessonPreviewSchema>;
