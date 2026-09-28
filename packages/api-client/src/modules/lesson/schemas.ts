import {
  cefrLevelSchema,
  explanationCardsContentSchema,
  freeProductionContentSchema,
  itemTypeSchema,
  lessonAttemptSourceSchema,
  practiceContentSchema,
  roleplayContentSchema,
  sceneContentSchema,
  summaryContentSchema,
  answerResponseSchema,
} from '@english-saas/shared';
import { z } from 'zod';

const LESSON_ATTEMPT_STATUSES = [
  'IN_PROGRESS',
  'COMPLETED',
  'ABANDONED',
] as const;
const ANSWER_VERDICTS = ['CORRECT', 'PARTIAL', 'INCORRECT'] as const;

export const resolvedAssetSchema = z.object({
  id: z.string(),
  mimeType: z.string(),
  durationMs: z.number().nullable(),
  url: z.string(),
});
export type ResolvedAsset = z.infer<typeof resolvedAssetSchema>;

export const lessonItemSchema = z.object({
  id: z.string(),
  type: itemTypeSchema,
  prompt: z.string(),
  content: z.record(z.string(), z.unknown()),
  cefrLevel: cefrLevelSchema,
  skillIds: z.array(z.string()),
});
export type LessonItem = z.infer<typeof lessonItemSchema>;

/** Mesma forma de `LessonStepInput` (`packages/shared`), com o `order` da lição. */
export const lessonStepViewSchema = z.discriminatedUnion('type', [
  z.object({
    order: z.number().int().min(0),
    type: z.literal('SCENE'),
    content: sceneContentSchema,
  }),
  z.object({
    order: z.number().int().min(0),
    type: z.literal('EXPLANATION_CARDS'),
    content: explanationCardsContentSchema,
  }),
  z.object({
    order: z.number().int().min(0),
    type: z.literal('PRACTICE'),
    content: practiceContentSchema,
  }),
  z.object({
    order: z.number().int().min(0),
    type: z.literal('FREE_PRODUCTION'),
    content: freeProductionContentSchema,
  }),
  z.object({
    order: z.number().int().min(0),
    type: z.literal('ROLEPLAY'),
    content: roleplayContentSchema,
  }),
  z.object({
    order: z.number().int().min(0),
    type: z.literal('SUMMARY'),
    content: summaryContentSchema,
  }),
]);
export type LessonStepView = z.infer<typeof lessonStepViewSchema>;

export const catalogLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  order: z.number(),
  version: z.number(),
  title: z.string(),
  objective: z.string(),
  cefrLevel: cefrLevelSchema,
  estimatedMinutes: z.number(),
  publishedAt: z.string().nullable(),
  unit: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    order: z.number(),
  }),
  level: z.object({ cefrLevel: cefrLevelSchema, title: z.string() }),
  targetSkills: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      competency: z.string(),
      cefrLevel: cefrLevelSchema,
    }),
  ),
  characters: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      bio: z.string().nullable(),
      avatarAssetId: z.string().nullable(),
    }),
  ),
  registerNotes: z.array(
    z.object({
      id: z.string(),
      spokenForm: z.string(),
      standardForm: z.string(),
      register: z.string(),
      explanation: z.string(),
      whenToAvoid: z.string().nullable(),
      audioAssetId: z.string().nullable(),
    }),
  ),
  items: z.array(lessonItemSchema),
  steps: z.array(lessonStepViewSchema),
  assets: z.record(z.string(), resolvedAssetSchema),
});
export type CatalogLesson = z.infer<typeof catalogLessonSchema>;

export const attemptStepSchema = z.object({
  index: z.number(),
  type: z.string(),
  completed: z.boolean(),
  itemIds: z.array(z.string()),
});

export const attemptViewSchema = z.object({
  id: z.string(),
  lessonId: z.string(),
  lessonVersionId: z.string(),
  version: z.number(),
  status: z.enum(LESSON_ATTEMPT_STATUSES),
  source: lessonAttemptSourceSchema,
  currentStepIndex: z.number(),
  totalSteps: z.number(),
  steps: z.array(attemptStepSchema),
  answeredItemIds: z.array(z.string()),
  xpEarned: z.number(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
});
export type AttemptView = z.infer<typeof attemptViewSchema>;

export const startAttemptResponseSchema = attemptViewSchema.extend({
  resumed: z.boolean(),
});
export type StartAttemptResponse = z.infer<typeof startAttemptResponseSchema>;

export const completeStepRequestSchema = z.object({
  timeSpentMs: z.number().int().min(0),
  response: z.object({ text: z.string().trim().min(1).max(5_000) }).optional(),
});
export type CompleteStepRequest = z.infer<typeof completeStepRequestSchema>;

export const correctAnswerViewSchema = z.union([
  z.object({ optionIds: z.array(z.string()), texts: z.array(z.string()) }),
  z.object({ text: z.string() }),
  z.object({
    pairs: z.array(z.object({ left: z.string(), right: z.string() })),
  }),
]);
export type CorrectAnswerView = z.infer<typeof correctAnswerViewSchema>;

export const itemErrorPatternSchema = z.object({
  id: z.string(),
  description: z.string(),
  correction: z.string(),
  explanation: z.string(),
});

export const answerResultSchema = z.object({
  answerId: z.string(),
  isCorrect: z.boolean(),
  score: z.number(),
  verdict: z.enum(ANSWER_VERDICTS),
  feedback: z.string(),
  explanation: z.string(),
  correctAnswer: correctAnswerViewSchema,
  errorPatterns: z.array(itemErrorPatternSchema),
  isFirstTry: z.boolean(),
});
export type AnswerResult = z.infer<typeof answerResultSchema>;

export const submitAnswerRequestSchema = z.object({
  itemId: z.string(),
  attemptId: z.string(),
  context: z.literal('LESSON'),
  response: answerResponseSchema,
  responseTimeMs: z.number().int().min(0),
  hintsUsed: z.number().int().min(0).default(0),
  clientAnswerId: z.string().min(8).max(64).optional(),
});
export type SubmitAnswerRequest = z.infer<typeof submitAnswerRequestSchema>;

export const lessonXpSchema = z.object({
  fromAnswers: z.number(),
  completionBonus: z.number(),
  total: z.number(),
});
export type LessonXp = z.infer<typeof lessonXpSchema>;

export const learningStatsSchema = z.object({
  totalXp: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastStudyDate: z.string().nullable(),
});

export const completionResultSchema = z.object({
  attempt: attemptViewSchema,
  xp: lessonXpSchema,
  stats: learningStatsSchema,
});
export type CompletionResult = z.infer<typeof completionResultSchema>;
