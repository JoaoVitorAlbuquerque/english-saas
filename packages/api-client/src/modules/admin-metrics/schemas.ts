import { z } from 'zod';

import { flaggedItemSchema } from '../curriculum-bank/schemas';

/**
 * Espelha `GET /admin/metrics` (módulo 14, somente ADMIN): lê as tabelas
 * diárias, então o intervalo termina, por padrão, **ontem** — o dia de hoje
 * ainda não passou pelo job noturno.
 *
 * Datas são `YYYY-MM-DD`; dinheiro de custo vem em micros de dólar e em
 * centavos de real (pelo câmbio fixo `usdBrlRate`).
 */

/** Maior intervalo que a API aceita (`MAX_METRICS_DAYS`). */
export const METRICS_MAX_DAYS = 180;

export const metricsPeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
  days: z.number(),
});
export type MetricsPeriod = z.infer<typeof metricsPeriodSchema>;

export const dailyActivitySchema = z.object({
  date: z.string(),
  dau: z.number(),
  wau: z.number(),
  mau: z.number(),
  newUsers: z.number(),
  lessonsStarted: z.number(),
  lessonsCompleted: z.number(),
});
export type DailyActivity = z.infer<typeof dailyActivitySchema>;

export const cohortSchema = z.object({
  /** Segunda-feira da semana de cadastro. */
  cohortWeek: z.string(),
  size: z.number(),
  weeks: z.array(
    z.object({
      /** 0 = a própria semana do cadastro. */
      offset: z.number(),
      retained: z.number(),
      /** `null` quando a coorte está vazia. */
      rate: z.number().nullable(),
    }),
  ),
});
export type Cohort = z.infer<typeof cohortSchema>;

export const stepDropoffSchema = z.object({
  stepIndex: z.number(),
  stepType: z.string().nullable(),
  count: z.number(),
});
export type StepDropoff = z.infer<typeof stepDropoffSchema>;

const lessonTotalsShape = {
  lessonId: z.string(),
  title: z.string().nullable(),
  started: z.number(),
  completed: z.number(),
  firstTryAnswers: z.number(),
  firstTryCorrect: z.number(),
  abandoned: z.number(),
  completionRate: z.number(),
  /** `null` = nenhuma resposta de primeira tentativa. */
  accuracy: z.number().nullable(),
};

export const lessonMetricSchema = z.object(lessonTotalsShape);
export type LessonMetric = z.infer<typeof lessonMetricSchema>;

export const lessonMetricWithDropoffSchema = z.object({
  ...lessonTotalsShape,
  abandonmentByStep: z.array(stepDropoffSchema),
});

export const lessonsSectionSchema = z.object({
  started: z.number(),
  completed: z.number(),
  /** `null` = nenhuma lição começou no período. */
  completionRate: z.number().nullable(),
  abandoned: z.number(),
  abandonmentByStep: z.array(stepDropoffSchema),
  byLesson: z.array(lessonMetricWithDropoffSchema),
  /** Só lições com volume mínimo de inícios; a API já ordena. */
  worst: z.array(lessonMetricSchema),
});
export type LessonsSection = z.infer<typeof lessonsSectionSchema>;

const costRowShape = {
  calls: z.number(),
  cacheHits: z.number(),
  costUsdMicros: z.number(),
  costBrlCents: z.number(),
};

export const aiCostSectionSchema = z.object({
  totalUsdMicros: z.number(),
  byFeature: z.array(z.object({ feature: z.string(), ...costRowShape })),
  /** `SYSTEM` = chamada sem aluno (rascunho do estúdio, por exemplo). */
  byTier: z.array(z.object({ tier: z.string(), ...costRowShape })),
  topUsers: z.array(
    z.object({
      userId: z.string(),
      email: z.string().nullable(),
      calls: z.number(),
      costUsdMicros: z.number(),
      costBrlCents: z.number(),
    }),
  ),
});
export type AiCostSection = z.infer<typeof aiCostSectionSchema>;

export const revenueTierSchema = z.object({
  tier: z.enum(['FREE', 'BASE', 'PLUS']),
  subscribers: z.number(),
  mrrCents: z.number(),
  activeUsers: z.number(),
  /** MRR distribuído pelos dias do período — contratado, não caixa. */
  revenueCents: z.number(),
  aiCostUsdMicros: z.number(),
  aiCostBrlCents: z.number(),
  marginCents: z.number(),
});
export type RevenueTier = z.infer<typeof revenueTierSchema>;

export const adminMetricsSchema = z.object({
  period: metricsPeriodSchema,
  activity: z.object({
    dau: z.number(),
    wau: z.number(),
    mau: z.number(),
    daily: z.array(dailyActivitySchema),
  }),
  retention: z.array(cohortSchema),
  lessons: lessonsSectionSchema,
  /** Itens com marcação de calibração aberta (até 50). */
  items: z.array(flaggedItemSchema),
  aiCost: aiCostSectionSchema,
  revenue: z.object({
    usdBrlRate: z.number(),
    byTier: z.array(revenueTierSchema),
  }),
});
export type AdminMetrics = z.infer<typeof adminMetricsSchema>;

export type MetricsRange = { from: string; to: string };
