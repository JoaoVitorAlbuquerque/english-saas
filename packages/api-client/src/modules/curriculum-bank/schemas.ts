import {
  cefrLevelSchema,
  contentStatusSchema,
  deprecateSchema,
  errorPatternAuthoringPatchSchema,
  errorPatternAuthoringSchema,
  errorPatternSchema,
  itemAuthoringPatchSchema,
  itemAuthoringSchema,
  itemCalibrationFlagSchema,
  itemTypeSchema,
  registerNoteAuthoringPatchSchema,
  registerNoteAuthoringSchema,
  registerNoteSchema,
  skillAuthoringPatchSchema,
  skillAuthoringSchema,
  skillSchema,
} from '@english-saas/shared';
import { z } from 'zod';

import { lessonItemSchema } from '../lesson/schemas';

/**
 * Espelha a autoria de taxonomia e do banco de questões
 * (`admin/curriculum/{skills,error-patterns,register-notes,items}`, módulo 4)
 * e a fila de itens problemáticos (`admin/assessment`, módulo 8).
 *
 * Os limites dos formulários vêm de `packages/shared` — a API usa os mesmos.
 */

function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

// ---------------------------------------------------------------------------
// Taxonomia
// ---------------------------------------------------------------------------

/**
 * A skill como o admin a lê: o contrato base (`skillSchema`, o mesmo do
 * catálogo) mais os carimbos de data que só a autoria devolve.
 */
export const adminSkillSchema = skillSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminSkill = z.infer<typeof adminSkillSchema>;
export const adminSkillPageSchema = paginated(adminSkillSchema);
export type AdminSkillPage = z.infer<typeof adminSkillPageSchema>;

export const adminErrorPatternSchema = errorPatternSchema;
export type AdminErrorPattern = z.infer<typeof adminErrorPatternSchema>;
export const adminErrorPatternPageSchema = paginated(adminErrorPatternSchema);
export type AdminErrorPatternPage = z.infer<typeof adminErrorPatternPageSchema>;

/** O áudio da nota, com URL assinada: nasce na resposta e nunca é guardada. */
export const registerNoteAudioSchema = z.object({
  url: z.string(),
  mimeType: z.string(),
  durationMs: z.number().int().nullable(),
});

/**
 * A nota de registro como o admin a lê: o contrato base mais o áudio (id e
 * URL) e os carimbos de data.
 */
export const adminRegisterNoteSchema = registerNoteSchema.extend({
  audioAssetId: z.uuid().nullable(),
  audio: registerNoteAudioSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminRegisterNote = z.infer<typeof adminRegisterNoteSchema>;
export const adminRegisterNotePageSchema = paginated(adminRegisterNoteSchema);
export type AdminRegisterNotePage = z.infer<typeof adminRegisterNotePageSchema>;

export const createSkillRequestSchema = skillAuthoringSchema;
export type CreateSkillRequest = z.infer<typeof createSkillRequestSchema>;
export const updateSkillRequestSchema = skillAuthoringPatchSchema;
export type UpdateSkillRequest = z.infer<typeof updateSkillRequestSchema>;

export const createErrorPatternRequestSchema = errorPatternAuthoringSchema;
export type CreateErrorPatternRequest = z.infer<
  typeof createErrorPatternRequestSchema
>;
export const updateErrorPatternRequestSchema = errorPatternAuthoringPatchSchema;
export type UpdateErrorPatternRequest = z.infer<
  typeof updateErrorPatternRequestSchema
>;

export const createRegisterNoteRequestSchema = registerNoteAuthoringSchema;
export type CreateRegisterNoteRequest = z.infer<
  typeof createRegisterNoteRequestSchema
>;
export const updateRegisterNoteRequestSchema = registerNoteAuthoringPatchSchema;
export type UpdateRegisterNoteRequest = z.infer<
  typeof updateRegisterNoteRequestSchema
>;

export const deprecateRequestSchema = deprecateSchema;
export type DeprecateRequest = z.infer<typeof deprecateRequestSchema>;

// ---------------------------------------------------------------------------
// Banco de questões
// ---------------------------------------------------------------------------

/** Item do banco, com o gabarito — só o editor vê. */
export const adminItemSchema = lessonItemSchema.extend({
  type: itemTypeSchema,
  slug: z.string().nullable(),
  acceptedAnswers: z.array(z.string()),
  explanation: z.string(),
  errorPatternMap: z.record(z.string(), z.string()),
  status: contentStatusSchema,
  /** `HUMAN`, `AI_DRAFT` ou `AI_DRAFT_REVIEWED`. */
  source: z.string(),
  difficulty: z.number(),
  discrimination: z.number(),
  exposureCount: z.number(),
  /** `null` até ter exposição suficiente (menos de 10 primeiras tentativas). */
  correctRate: z.number().nullable(),
  /** O item que substitui este, quando já existe uma revisão. */
  replacedById: z.string().nullable(),
  /** O item que esta revisão substitui. */
  replaces: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminItem = z.infer<typeof adminItemSchema>;
export const adminItemPageSchema = paginated(adminItemSchema);
export type AdminItemPage = z.infer<typeof adminItemPageSchema>;

/** Onde um item está em uso: as lições no ar que o referenciam. */
export const itemUsageSchema = z.object({
  lessonId: z.string(),
  lessonSlug: z.string(),
  versionId: z.string(),
  version: z.number(),
  status: contentStatusSchema,
  title: z.string(),
});
export type ItemUsage = z.infer<typeof itemUsageSchema>;

/** A ficha do item (`GET items/:id`) e a resposta de toda escrita. */
export const adminItemDetailSchema = adminItemSchema.extend({
  /** URL assinada do áudio (escuta e ditado), quando o item já tem um. */
  audioUrl: z.string().nullable(),
  usedIn: z.array(itemUsageSchema),
});
export type AdminItemDetail = z.infer<typeof adminItemDetailSchema>;

export const createItemRequestSchema = itemAuthoringSchema;
export type CreateItemRequest = z.infer<typeof createItemRequestSchema>;
export const updateItemRequestSchema = itemAuthoringPatchSchema;
export type UpdateItemRequest = z.infer<typeof updateItemRequestSchema>;

export const ITEM_ACTIONS = [
  'submit-for-review',
  'approve',
  'reject',
  'publish',
  'archive',
] as const;
export type ItemAction = (typeof ITEM_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Itens problemáticos (módulo 8)
// ---------------------------------------------------------------------------

/** O resumo do item numa linha de tabela: sem conteúdo nem gabarito. */
export const itemSummarySchema = z.object({
  id: z.string(),
  type: itemTypeSchema,
  prompt: z.string(),
  cefrLevel: cefrLevelSchema,
  status: contentStatusSchema,
  source: z.string(),
  difficulty: z.number(),
  discrimination: z.number(),
  exposureCount: z.number(),
  correctRate: z.number().nullable(),
  skillIds: z.array(z.string()),
});
export type ItemSummary = z.infer<typeof itemSummarySchema>;

export const flaggedItemSchema = z.object({
  item: itemSummarySchema,
  flags: z.array(itemCalibrationFlagSchema),
  pValue: z.number(),
  pointBiserial: z.number().nullable(),
  responses: z.number(),
  previousDifficulty: z.number(),
  appliedDifficulty: z.number(),
  calibratedAt: z.string(),
});
export type FlaggedItem = z.infer<typeof flaggedItemSchema>;
export const flaggedItemPageSchema = paginated(flaggedItemSchema);
export type FlaggedItemPage = z.infer<typeof flaggedItemPageSchema>;

export const calibrationEntrySchema = z.object({
  calibratedAt: z.string(),
  responses: z.number(),
  pValue: z.number(),
  estimatedDifficulty: z.number(),
  previousDifficulty: z.number(),
  appliedDifficulty: z.number(),
  pointBiserial: z.number().nullable(),
  flags: z.array(itemCalibrationFlagSchema),
  resolvedAt: z.string().nullable(),
});
export type CalibrationEntry = z.infer<typeof calibrationEntrySchema>;

export const itemStatsSchema = z.object({
  itemId: z.string(),
  exposureCount: z.number(),
  correctRate: z.number().nullable(),
  difficulty: z.number(),
  /** Com que dificuldade o item começou: a atual é sobrescrita pela calibração. */
  initialDifficulty: z.number(),
  discrimination: z.number(),
  /** Marcações ainda não resolvidas. Vazio = sem alerta. */
  flags: z.array(itemCalibrationFlagSchema),
  lastCalibratedAt: z.string().nullable(),
  history: z.array(calibrationEntrySchema),
});
export type ItemStats = z.infer<typeof itemStatsSchema>;

export const resolveFlaggedResultSchema = z.object({ resolved: z.number() });
