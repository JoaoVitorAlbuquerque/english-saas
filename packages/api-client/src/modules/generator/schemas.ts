import {
  answerResponseSchema,
  cefrLevelSchema,
  spanKindSchema,
} from '@english-saas/shared';
import { z } from 'zod';

import { studentItemViewSchema } from '../lesson/schemas';

/**
 * Contratos do generator (módulo 13 do back-end), espelhados à mão — a DTO
 * de saída não é exportada para `packages/shared`.
 */

export const GENERATION_KINDS = ['SUGGEST', 'TOPIC', 'INGEST'] as const;
export const generationKindSchema = z.enum(GENERATION_KINDS);
export type GenerationKind = z.infer<typeof generationKindSchema>;

export const GENERATION_STATUSES = [
  'QUEUED',
  'RUNNING',
  'DONE',
  'FAILED',
  'REFUSED',
] as const;
export const generationStatusSchema = z.enum(GENERATION_STATUSES);
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

/** Terminou — com ou sem material. O polling para aqui. */
export const FINAL_GENERATION_STATUSES: readonly GenerationStatus[] = [
  'DONE',
  'FAILED',
  'REFUSED',
];

export const GENERATION_STEPS = [
  'SUGGEST',
  'INGEST_SOURCE',
  'ANALYZE',
  'FETCH_SOURCE',
  'PICK_TARGETS',
  'GENERATE',
  'VALIDATE',
  'EXERCISES',
  'DELIVER',
] as const;
export const generationStepSchema = z.enum(GENERATION_STEPS);
export type GenerationStep = z.infer<typeof generationStepSchema>;

export const stepStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'DONE',
  'FAILED',
]);
export type StepStatus = z.infer<typeof stepStatusSchema>;

export const generationStepStateSchema = z.object({
  step: generationStepSchema,
  status: stepStatusSchema,
  label: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type GenerationStepState = z.infer<typeof generationStepStateSchema>;

export const topicSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  whyInteresting: z.string(),
  category: z.string(),
});
export type TopicSuggestion = z.infer<typeof topicSuggestionSchema>;

export const generationJobSchema = z.object({
  id: z.string(),
  kind: generationKindSchema,
  status: generationStatusSchema,
  /** pt-BR, pronta para exibir — inclusive "o crédito voltou". */
  message: z.string(),
  steps: z.array(generationStepStateSchema),
  themes: z.array(z.string()),
  suggestions: z.array(topicSuggestionSchema),
  materialId: z.string().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type GenerationJob = z.infer<typeof generationJobSchema>;

export const suggestTopicsRequestSchema = z.object({
  interestText: z.string().trim().min(2).max(500),
  clientRequestId: z.string().optional(),
});
export type SuggestTopicsRequest = z.infer<typeof suggestTopicsRequestSchema>;

/** Exatamente um de `suggestionId`, `title` ou `surprise`. */
export const generateTopicRequestSchema = z.union([
  z.object({
    suggestionId: z.string(),
    clientRequestId: z.string().optional(),
  }),
  z.object({
    title: z.string().trim().min(2).max(160),
    clientRequestId: z.string().optional(),
  }),
  z.object({
    surprise: z.literal(true),
    clientRequestId: z.string().optional(),
  }),
]);
export type GenerateTopicRequest = z.infer<typeof generateTopicRequestSchema>;

/** Limites do `IngestContentDto` e do `MIN_INGEST_CHARS` do back-end. */
export const INGEST_MIN_CHARS = 200;
export const INGEST_MAX_CHARS = 40_000;

export const ingestRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(INGEST_MAX_CHARS).optional(),
    url: z.string().trim().min(8).max(2_000).optional(),
    clientRequestId: z.string().optional(),
  })
  .refine((data) => data.text !== undefined || data.url !== undefined);
export type IngestRequest = z.infer<typeof ingestRequestSchema>;

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

const MATERIAL_KINDS = ['TOPIC', 'INGEST'] as const;

export const materialSpanSchema = z.object({
  start: z.number(),
  end: z.number(),
  kind: spanKindSchema,
  skillId: z.string().optional(),
  registerNoteId: z.string().optional(),
  explanationPtBr: z.string(),
});
export type MaterialSpan = z.infer<typeof materialSpanSchema>;

export const materialVocabularySchema = z.object({
  term: z.string(),
  meaningPtBr: z.string(),
  example: z.string(),
  cefr: cefrLevelSchema,
  /** Termo normalizado — a chave das rotas de revisão do vocabulário. */
  termKey: z.string(),
  inReview: z.boolean(),
});
export type MaterialVocabulary = z.infer<typeof materialVocabularySchema>;

export const materialContentSchema = z.object({
  title: z.string(),
  level: cefrLevelSchema,
  text: z.string(),
  spans: z.array(materialSpanSchema),
  grammarSpotlight: z.array(
    z.object({
      skillId: z.string(),
      structure: z.string(),
      examplesFromText: z.array(z.string()),
      explanationPtBr: z.string(),
    }),
  ),
  spokenVersion: z.object({
    setup: z.string(),
    lines: z.array(
      z.object({
        speaker: z.string(),
        spoken: z.string(),
        standard: z.string().nullable(),
      }),
    ),
  }),
  registerNotes: z.array(
    z.object({
      registerNoteId: z.string().nullable(),
      spoken: z.string(),
      standard: z.string(),
      notePtBr: z.string(),
    }),
  ),
  vocabulary: z.array(materialVocabularySchema),
});
export type MaterialContent = z.infer<typeof materialContentSchema>;

export const materialAttributionSchema = z.object({
  provider: z.string(),
  title: z.string(),
  url: z.string(),
  license: z.string(),
  licenseUrl: z.string().nullable().optional(),
});
export type MaterialAttribution = z.infer<typeof materialAttributionSchema>;

export const materialExerciseSchema = studentItemViewSchema.extend({
  /** Primeira resposta do aluno, se já respondeu (uma por exercício). */
  answer: z.object({ isCorrect: z.boolean(), score: z.number() }).nullable(),
});
export type MaterialExercise = z.infer<typeof materialExerciseSchema>;

export const materialDifficultySchema = z.enum(['TOO_EASY', 'OK', 'TOO_HARD']);
export type MaterialDifficulty = z.infer<typeof materialDifficultySchema>;

const targetSkillSchema = z.object({ id: z.string(), title: z.string() });

export const materialDetailSchema = z.object({
  id: z.string(),
  kind: z.enum(MATERIAL_KINDS),
  title: z.string(),
  level: cefrLevelSchema,
  topic: z.string(),
  targetSkills: z.array(targetSkillSchema),
  content: materialContentSchema,
  attribution: materialAttributionSchema.nullable(),
  referenceUrl: z.string().nullable(),
  exercises: z.array(materialExerciseSchema),
  feedback: z.object({
    rating: z.number().nullable(),
    difficulty: materialDifficultySchema.nullable(),
  }),
  createdAt: z.string(),
});
export type MaterialDetail = z.infer<typeof materialDetailSchema>;

export const materialSummarySchema = z.object({
  id: z.string(),
  kind: z.enum(MATERIAL_KINDS),
  title: z.string(),
  level: cefrLevelSchema,
  topic: z.string(),
  targetSkills: z.array(targetSkillSchema),
  exerciseCount: z.number(),
  rating: z.number().nullable(),
  difficulty: materialDifficultySchema.nullable(),
  createdAt: z.string(),
});
export type MaterialSummary = z.infer<typeof materialSummarySchema>;

export const materialsPageSchema = z.object({
  data: z.array(materialSummarySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type MaterialsPage = z.infer<typeof materialsPageSchema>;

export const materialAnswerRequestSchema = z.object({
  itemId: z.string(),
  response: answerResponseSchema,
  responseTimeMs: z.number().int().min(0),
  hintsUsed: z.number().int().min(0).default(0),
});
export type MaterialAnswerRequest = z.input<typeof materialAnswerRequestSchema>;

export const materialFeedbackRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  difficulty: materialDifficultySchema.optional(),
});
export type MaterialFeedbackRequest = z.infer<
  typeof materialFeedbackRequestSchema
>;

export const materialFeedbackSchema = z.object({
  id: z.string(),
  rating: z.number().nullable(),
  difficulty: materialDifficultySchema.nullable(),
});
export type MaterialFeedback = z.infer<typeof materialFeedbackSchema>;

export const termReviewStateSchema = z.object({
  termKey: z.string(),
  inReview: z.boolean(),
});
export type TermReviewState = z.infer<typeof termReviewStateSchema>;
