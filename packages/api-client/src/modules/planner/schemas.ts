import { cefrLevelSchema } from '@english-saas/shared';
import { z } from 'zod';

import { studentItemViewSchema } from '../lesson/schemas';

/** `StudyPlan.path` não expõe `slug` (só `lessonId`) — por isso o resumo da
 * lição (F4) e o bloco LESSON da agenda mostram o título, sem link direto. */
export const planPathEntrySchema = z.object({
  lessonId: z.string(),
  slug: z.string(),
  unitId: z.string(),
  title: z.string(),
  cefrLevel: cefrLevelSchema,
  estimatedMinutes: z.number(),
  order: z.number(),
  reason: z.string(),
});
export type PlanPathEntry = z.infer<typeof planPathEntrySchema>;

export const planForecastSchema = z.object({
  estimatedArrival: z.string().nullable(),
  weeksNeeded: z.number().nullable(),
  realistic: z.boolean(),
  message: z.string().nullable(),
});
export type PlanForecast = z.infer<typeof planForecastSchema>;

export const studyPlanSchema = z.object({
  targetLevel: cefrLevelSchema,
  targetDate: z.string().nullable(),
  path: z.array(planPathEntrySchema),
  reinforceSkillIds: z.array(z.string()),
  forecast: planForecastSchema.nullable(),
  version: z.number(),
});
export type StudyPlan = z.infer<typeof studyPlanSchema>;

export const rebuildPlanRequestSchema = z.object({
  targetLevel: cefrLevelSchema.optional(),
});
export type RebuildPlanRequest = z.infer<typeof rebuildPlanRequestSchema>;

/** `GET /me/plan/forecast` — o mesmo forecast do plano + o aviso de ritmo. */
export const forecastStatusSchema = z.object({
  forecast: planForecastSchema,
  weeksBehind: z.number(),
  message: z.string().nullable(),
});
export type ForecastStatus = z.infer<typeof forecastStatusSchema>;

// --- Agenda -----------------------------------------------------------

const AGENDA_BLOCK_TYPES = ['REVIEW', 'LESSON', 'PRACTICE'] as const;
export const AGENDA_SKIP_REASONS = [
  'NO_TIME',
  'ALREADY_KNOW',
  'TOO_HARD',
  'OTHER',
] as const;
export type AgendaSkipReason = (typeof AGENDA_SKIP_REASONS)[number];

const AGENDA_BLOCK_STATUSES = ['PENDING', 'COMPLETED', 'SKIPPED'] as const;
export type AgendaBlockStatus = (typeof AGENDA_BLOCK_STATUSES)[number];

export const agendaBlockSchema = z.object({
  id: z.string(),
  type: z.enum(AGENDA_BLOCK_TYPES),
  refId: z.string(),
  estimatedMinutes: z.number(),
  reason: z.string(),
  title: z.string().optional(),
  slug: z.string().optional(),
  count: z.number().optional(),
  status: z.enum(AGENDA_BLOCK_STATUSES),
  skipReason: z.enum(AGENDA_SKIP_REASONS).optional(),
  skipNote: z.string().optional(),
  completedAt: z.string().optional(),
  minutesSpent: z.number().optional(),
  /** Só em PRACTICE — o item completo (sem gabarito), pronto pro `ItemRenderer`. */
  item: studentItemViewSchema.optional(),
});
export type AgendaBlock = z.infer<typeof agendaBlockSchema>;

export const dailyAgendaSchema = z.object({
  localDate: z.string(),
  generatedAt: z.string(),
  blocks: z.array(agendaBlockSchema),
  minutesCompleted: z.number(),
});
export type DailyAgenda = z.infer<typeof dailyAgendaSchema>;

export const skipBlockRequestSchema = z.object({
  reason: z.enum(AGENDA_SKIP_REASONS).optional(),
  note: z.string().trim().min(1).max(280).optional(),
});
export type SkipBlockRequest = z.infer<typeof skipBlockRequestSchema>;

export const completeBlockRequestSchema = z.object({
  minutesSpent: z.number().int().min(0).optional(),
});
export type CompleteBlockRequest = z.infer<typeof completeBlockRequestSchema>;
