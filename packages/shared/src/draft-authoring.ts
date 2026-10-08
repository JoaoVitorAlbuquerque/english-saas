import { z } from 'zod';

import { cefrLevelSchema } from './cefr';
import { contentSlugSchema, taxonomySlugSchema } from './curriculum';
import { DRAFTABLE_ITEM_TYPES } from './item-content';

/**
 * Pedidos de rascunho ao estúdio de conteúdo (módulo 5) — os limites que a
 * API aplica em `POST admin/content-studio/drafts/*` e que o formulário do
 * admin confere ao vivo.
 */

export const DRAFT_KINDS = ['LESSON', 'ITEMS', 'REGISTER_NOTES'] as const;
export const draftKindSchema = z.enum(DRAFT_KINDS);
export type DraftKind = z.infer<typeof draftKindSchema>;

export const DRAFT_STATUSES = [
  'QUEUED',
  'GENERATING',
  'QA_RUNNING',
  'READY',
  'FAILED',
  'DISCARDED',
] as const;
export const draftStatusSchema = z.enum(DRAFT_STATUSES);
export type DraftStatus = z.infer<typeof draftStatusSchema>;

export const DRAFT_LIMITS = {
  objective: { min: 4, max: 300 },
  title: { min: 2, max: 160 },
  unitContext: { max: 2_000 },
  targetSkills: { min: 1, max: 8 },
  characters: { min: 1, max: 6 },
  itemCount: { min: 1, max: 20 },
  noteCount: { min: 1, max: 15 },
} as const;

export const DEFAULT_DRAFT_ITEM_TYPES = [
  'MULTIPLE_CHOICE',
  'FILL_BLANK',
  'ORDER_WORDS',
] as const;

export const requestLessonDraftSchema = z
  .object({
    /** Lição que já existe. Sem ela, informe unidade, slug e posição. */
    lessonId: z.uuid().optional(),
    unitId: z.uuid().optional(),
    slug: contentSlugSchema.optional(),
    order: z.number().int().min(0).optional(),
    title: z
      .string()
      .trim()
      .min(DRAFT_LIMITS.title.min)
      .max(DRAFT_LIMITS.title.max)
      .optional(),

    /** Can-do em pt-BR. */
    objective: z
      .string()
      .trim()
      .min(DRAFT_LIMITS.objective.min)
      .max(DRAFT_LIMITS.objective.max),
    level: cefrLevelSchema,
    targetSkillIds: z
      .array(taxonomySlugSchema)
      .min(DRAFT_LIMITS.targetSkills.min)
      .max(DRAFT_LIMITS.targetSkills.max),
    characterIds: z
      .array(z.uuid())
      .min(DRAFT_LIMITS.characters.min)
      .max(DRAFT_LIMITS.characters.max),
    /** O que já aconteceu na série, para a cena ter continuidade. */
    unitContext: z.string().trim().max(DRAFT_LIMITS.unitContext.max).optional(),
  })
  .refine(
    (body) =>
      body.lessonId !== undefined ||
      (body.unitId !== undefined &&
        body.slug !== undefined &&
        body.order !== undefined),
    {
      message:
        'Informe `lessonId`, ou `unitId` + `slug` + `order` para criar a lição.',
      path: ['lessonId'],
    },
  );
export type RequestLessonDraft = z.infer<typeof requestLessonDraftSchema>;

export const requestItemsDraftSchema = z.object({
  skillId: taxonomySlugSchema,
  level: cefrLevelSchema,
  count: z
    .number()
    .int()
    .min(DRAFT_LIMITS.itemCount.min)
    .max(DRAFT_LIMITS.itemCount.max),
  types: z
    .array(z.enum(DRAFTABLE_ITEM_TYPES))
    .min(1)
    .default([...DEFAULT_DRAFT_ITEM_TYPES]),
});
export type RequestItemsDraft = z.input<typeof requestItemsDraftSchema>;

export const requestRegisterNotesDraftSchema = z.object({
  level: cefrLevelSchema,
  count: z
    .number()
    .int()
    .min(DRAFT_LIMITS.noteCount.min)
    .max(DRAFT_LIMITS.noteCount.max),
});
export type RequestRegisterNotesDraft = z.infer<
  typeof requestRegisterNotesDraftSchema
>;
