import { cefrLevelSchema } from '@english-saas/shared';
import { z } from 'zod';

export const learningStatsSchema = z.object({
  totalXp: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastStudyDate: z.string().nullable(),
});
export type LearningStats = z.infer<typeof learningStatsSchema>;

/** Espelha `HistoryController`/`AttemptService.history` (learning, módulo 6). */
export const ATTEMPT_STATUSES = [
  'IN_PROGRESS',
  'COMPLETED',
  'ABANDONED',
] as const;

export const lessonHistoryEntrySchema = z.object({
  attemptId: z.string(),
  lessonId: z.string(),
  lessonSlug: z.string().nullable(),
  title: z.string().nullable(),
  cefrLevel: cefrLevelSchema.nullable(),
  version: z.number(),
  status: z.enum(ATTEMPT_STATUSES),
  source: z.string(),
  currentStepIndex: z.number(),
  xpEarned: z.number(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
});
export type LessonHistoryEntry = z.infer<typeof lessonHistoryEntrySchema>;

export const lessonHistoryPageSchema = z.object({
  data: z.array(lessonHistoryEntrySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type LessonHistoryPage = z.infer<typeof lessonHistoryPageSchema>;
