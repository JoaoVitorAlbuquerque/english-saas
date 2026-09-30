import { answerResponseSchema } from '@english-saas/shared';
import { z } from 'zod';

import { studentItemViewSchema } from '../lesson/schemas';

/**
 * Espelha `apps/api/src/modules/assessment/{controllers/checkpoint.controller.ts,
 * services/checkpoint.service.ts}` — diagnóstico de unidade (módulo 8), mesmo
 * fluxo start/answer do nivelamento, mas sem `GET .../latest`: começar de
 * novo sempre cria um checkpoint novo (nunca trava, pode ser refeito).
 */

export const CHECKPOINT_STATUSES = ['IN_PROGRESS', 'COMPLETED'] as const;
export const checkpointStatusSchema = z.enum(CHECKPOINT_STATUSES);

export const CHECKPOINT_RESULTS = [
  'PASSED',
  'PASSED_WITH_REINFORCEMENT',
  'NEEDS_REINFORCEMENT',
] as const;
export const checkpointResultKindSchema = z.enum(CHECKPOINT_RESULTS);

export const checkpointResultSchema = z.object({
  result: checkpointResultKindSchema,
  message: z.string(),
  score: z.number(),
  reinforce: z.array(z.object({ skillId: z.string(), title: z.string() })),
  completedAt: z.string().nullable(),
});
export type CheckpointResult = z.infer<typeof checkpointResultSchema>;

export const checkpointStateSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  status: checkpointStatusSchema,
  answered: z.number(),
  maxItems: z.number(),
  next: studentItemViewSchema.nullable(),
  result: checkpointResultSchema.nullable(),
});
export type CheckpointState = z.infer<typeof checkpointStateSchema>;

export const checkpointAnswerRequestSchema = z.object({
  itemId: z.string(),
  response: answerResponseSchema,
  responseTimeMs: z.number().int().min(0),
  clientAnswerId: z.string().min(8).max(64).optional(),
});
export type CheckpointAnswerRequest = z.infer<
  typeof checkpointAnswerRequestSchema
>;
