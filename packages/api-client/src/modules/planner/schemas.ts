import { cefrLevelSchema } from '@english-saas/shared';
import { z } from 'zod';

/**
 * Só o que o resumo da lição precisa: o título da próxima lição do path.
 * `StudyPlan.path` não expõe `slug` (só `lessonId`) — por isso o resumo
 * mostra o título, sem link direto (ver decisão no plano do F4).
 */
export const planPathEntrySchema = z.object({
  lessonId: z.string(),
  unitId: z.string(),
  title: z.string(),
  cefrLevel: cefrLevelSchema,
  estimatedMinutes: z.number(),
  order: z.number(),
  reason: z.string(),
});

export const studyPlanSchema = z.object({
  path: z.array(planPathEntrySchema),
});
export type StudyPlan = z.infer<typeof studyPlanSchema>;
