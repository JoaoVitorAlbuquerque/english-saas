import { cefrLevelSchema, competencySchema } from '@english-saas/shared';
import { z } from 'zod';

/**
 * `GET /me/progress` (módulo 14) — espelha `StudentProgress` do back-end.
 * Datas são `YYYY-MM-DD` no fuso do aluno; a tela as formata por string.
 */

export const confidenceLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const progressCompetencySchema = z.object({
  competency: competencySchema,
  label: z.string(),
  /** `null`: ainda sem evidência nenhuma. */
  level: cefrLevelSchema.nullable(),
  /** Texto pt-BR pronto ("Estimativa razoável"). */
  confidence: z.string(),
  confidenceLevel: confidenceLevelSchema,
});
export type ProgressCompetency = z.infer<typeof progressCompetencySchema>;

export const weeklyLevelSchema = z.object({
  weekStart: z.string(),
  overallLevel: cefrLevelSchema.nullable(),
  levels: z.partialRecord(competencySchema, cefrLevelSchema.nullable()),
});
export type WeeklyLevel = z.infer<typeof weeklyLevelSchema>;

export const WEAKNESS_ACTION_TYPES = [
  'LESSON',
  'REVIEW',
  'MATERIAL',
  'PRACTICE',
] as const;
export const weaknessActionSchema = z.object({
  type: z.enum(WEAKNESS_ACTION_TYPES),
  refId: z.string().nullable(),
  /** Só em `LESSON`: o que a rota `/licoes/:slug` recebe. */
  lessonSlug: z.string().nullable(),
  label: z.string(),
});
export type WeaknessAction = z.infer<typeof weaknessActionSchema>;

export const ERROR_TRENDS = [
  'DECREASING',
  'STABLE',
  'INCREASING',
  'NOT_ENOUGH_DATA',
] as const;
export const errorTrendSchema = z.enum(ERROR_TRENDS);
export type ErrorTrend = z.infer<typeof errorTrendSchema>;

export const topErrorSchema = z.object({
  errorPatternId: z.string(),
  description: z.string(),
  correction: z.string(),
  recentOccurrences: z.number(),
  opportunities: z.number(),
  trend: errorTrendSchema,
  trendLabel: z.string(),
});
export type TopError = z.infer<typeof topErrorSchema>;

export const weekComplianceSchema = z.object({
  weekStart: z.string(),
  plannedMinutes: z.number(),
  studiedMinutes: z.number(),
  /** Feito ÷ planejado; `null` quando nada foi planejado. */
  ratio: z.number().nullable(),
});
export type WeekCompliance = z.infer<typeof weekComplianceSchema>;

export const PACE_STATUSES = [
  'ON_TRACK',
  'AHEAD',
  'BEHIND',
  'TOO_EARLY',
  'NO_STUDY',
  'NO_PLAN',
] as const;
export const paceStatusSchema = z.enum(PACE_STATUSES);
export type PaceStatus = z.infer<typeof paceStatusSchema>;

export const progressForecastSchema = z.object({
  byPlan: z.string().nullable(),
  byPace: z.string().nullable(),
  /** Positivo = atrasado; negativo = adiantado. */
  weeksDifference: z.number().nullable(),
  status: paceStatusSchema,
  message: z.string(),
  targetLevel: cefrLevelSchema.nullable(),
});
export type ProgressForecast = z.infer<typeof progressForecastSchema>;

export const studentProgressSchema = z.object({
  period: z.object({ from: z.string(), to: z.string(), weeks: z.number() }),
  level: z.object({
    overall: z.object({
      level: cefrLevelSchema,
      label: z.string(),
      note: z.string(),
    }),
    competencies: z.array(progressCompetencySchema),
    weekly: z.array(weeklyLevelSchema),
  }),
  strengths: z.array(
    z.object({ skillId: z.string(), title: z.string(), text: z.string() }),
  ),
  weaknesses: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      text: z.string(),
      action: weaknessActionSchema,
    }),
  ),
  stats: z.object({
    minutesStudied: z.number(),
    lessonsCompleted: z.number(),
    reviewsDone: z.number(),
    currentStreak: z.number(),
    longestStreak: z.number(),
    accuracyByCompetency: z.array(
      z.object({
        competency: competencySchema,
        label: z.string(),
        answered: z.number(),
        correct: z.number(),
        rate: z.number().nullable(),
        text: z.string(),
      }),
    ),
    topErrors: z.array(topErrorSchema),
  }),
  plan: z.object({ weeks: z.array(weekComplianceSchema) }),
  forecast: progressForecastSchema,
});
export type StudentProgress = z.infer<typeof studentProgressSchema>;

/** Semanas que a API aceita (`ProgressQueryDto`). */
export const PROGRESS_WEEKS_MIN = 4;
export const PROGRESS_WEEKS_MAX = 26;
export const PROGRESS_WEEKS_DEFAULT = 8;
