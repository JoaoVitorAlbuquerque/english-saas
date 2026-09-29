import { z } from 'zod';

export const learningStatsSchema = z.object({
  totalXp: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastStudyDate: z.string().nullable(),
});
export type LearningStats = z.infer<typeof learningStatsSchema>;
