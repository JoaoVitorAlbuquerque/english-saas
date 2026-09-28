import {
  answerResponseSchema,
  cefrLevelSchema,
  competencySchema,
  itemTypeSchema,
} from '@english-saas/shared';
import { z } from 'zod';

/**
 * Espelha `apps/api/src/modules/assessment/controllers/placement.controller.ts`
 * e o retorno de `PlacementService` — não está em `packages/shared`, então o
 * contrato vive aqui até que passe a ser compartilhado.
 *
 * `content` fica solto (`Record<string, unknown>`): a forma exata depende do
 * `type` do item (é o `StudentItem` do curriculum, já sem gabarito) e é
 * estreitada por tipo em `apps/web/.../placement/Placement/item-mapping.ts`.
 */

const resolvedAssetSchema = z.object({
  id: z.string(),
  mimeType: z.string(),
  durationMs: z.number().nullable(),
  url: z.string(),
});

export const placementItemSchema = z.object({
  id: z.string(),
  type: itemTypeSchema,
  prompt: z.string(),
  content: z.record(z.string(), z.unknown()),
  cefrLevel: cefrLevelSchema,
  skillIds: z.array(z.string()),
  assets: z.record(z.string(), resolvedAssetSchema),
});
export type PlacementItem = z.infer<typeof placementItemSchema>;

export const placementStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED']);
export type PlacementStatus = z.infer<typeof placementStatusSchema>;

const writingStatusSchema = z.enum(['NOT_OFFERED', 'PENDING', 'SCORED']);

export const placementCompetencyResultSchema = z.object({
  competency: competencySchema,
  label: z.string(),
  level: cefrLevelSchema,
  items: z.number(),
});
export type PlacementCompetencyResult = z.infer<
  typeof placementCompetencyResultSchema
>;

export const placementResultSchema = z.object({
  overallLevel: cefrLevelSchema,
  label: z.string(),
  competencies: z.array(placementCompetencyResultSchema),
  masteredSkillIds: z.array(z.string()),
  note: z.string().nullable(),
  writingStatus: writingStatusSchema,
  completedAt: z.string().nullable(),
  nextAvailableAt: z.string().nullable(),
});
export type PlacementResult = z.infer<typeof placementResultSchema>;

export const placementStateSchema = z.object({
  id: z.string(),
  status: placementStatusSchema,
  answered: z.number(),
  maxItems: z.number(),
  next: placementItemSchema.nullable(),
  result: placementResultSchema.nullable(),
});
export type PlacementState = z.infer<typeof placementStateSchema>;

export const placementAnswerRequestSchema = z.object({
  itemId: z.string(),
  response: answerResponseSchema,
  responseTimeMs: z.number().int().min(0),
  clientAnswerId: z.string().min(8).max(64).optional(),
});
export type PlacementAnswerRequest = z.infer<
  typeof placementAnswerRequestSchema
>;
