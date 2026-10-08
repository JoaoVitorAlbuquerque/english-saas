import {
  cefrLevelSchema,
  contentStatusSchema,
  draftKindSchema,
  draftStatusSchema,
  requestItemsDraftSchema,
  requestLessonDraftSchema,
  requestRegisterNotesDraftSchema,
} from '@english-saas/shared';
import { z } from 'zod';

/**
 * Espelha o estúdio de conteúdo (`admin/content-studio`, módulo 5): rascunhos
 * por IA, revisão automática, comentários, áudio e apostilas.
 *
 * Os limites dos pedidos vêm de `packages/shared` — a API usa os mesmos.
 */

function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

// ---------------------------------------------------------------------------
// Revisão automática (QA)
// ---------------------------------------------------------------------------

export const QA_SEVERITIES = ['BLOCKER', 'WARNING', 'INFO'] as const;
export const qaSeveritySchema = z.enum(QA_SEVERITIES);
export type QaSeverity = z.infer<typeof qaSeveritySchema>;

export const qaWarningSchema = z.object({
  code: z.string(),
  severity: qaSeveritySchema,
  /** pt-BR, para o editor ler. */
  message: z.string(),
  /** Onde: `steps.2.lines.1`, `items.0`, `level`… (formatos variam). */
  path: z.string().optional(),
});
export type QaWarning = z.infer<typeof qaWarningSchema>;

/** Estatística de nível. Chega `{}` quando não havia texto para medir. */
export const levelStatsSchema = z.object({
  totalWords: z.number().optional(),
  outOfLevelCount: z.number().optional(),
  /** Fração de palavras acima do nível (0–1). */
  ratio: z.number().optional(),
  /** Fração das palavras que a lista de frequência conhece (0–1). */
  coverage: z.number().optional(),
  outOfLevel: z
    .array(z.object({ word: z.string(), band: cefrLevelSchema }))
    .optional(),
  wordlistSize: z.number().optional(),
});
export type LevelStats = z.infer<typeof levelStatsSchema>;

export const qaReportSchema = z.object({
  id: z.string(),
  warnings: z.array(qaWarningSchema),
  levelStats: levelStatsSchema,
  blockerCount: z.number(),
  warningCount: z.number(),
  infoCount: z.number(),
  ranAt: z.string(),
});
export type QaReport = z.infer<typeof qaReportSchema>;

// ---------------------------------------------------------------------------
// Rascunhos
// ---------------------------------------------------------------------------

export const draftSchema = z.object({
  id: z.string(),
  kind: draftKindSchema,
  status: draftStatusSchema,
  /** O pedido original: o formato depende do `kind`. */
  params: z.record(z.string(), z.unknown()),
  promptId: z.string().nullable(),
  promptVersion: z.number().nullable(),
  model: z.string().nullable(),
  /** Custo real em micros de dólar; `null` até a IA responder. */
  costUsdMicros: z.number().nullable(),
  lessonVersionId: z.string().nullable(),
  createdItemIds: z.array(z.string()),
  createdRegisterNoteIds: z.array(z.string()),
  errorCode: z.string().nullable(),
  generatedAt: z.string().nullable(),
  discardedAt: z.string().nullable(),
  createdAt: z.string(),
  requestedBy: z.object({ id: z.string(), name: z.string().nullable() }),
  /** No máximo o último relatório. */
  qaReports: z.array(qaReportSchema),
});
export type Draft = z.infer<typeof draftSchema>;

export const draftPageSchema = paginated(draftSchema);
export type DraftPage = z.infer<typeof draftPageSchema>;

export const draftEstimateSchema = z.object({
  /** `null` = não há histórico para estimar. */
  usdMicros: z.number().nullable(),
  /** Quantos pedidos entraram na média. */
  basedOn: z.number(),
});
export type DraftEstimate = z.infer<typeof draftEstimateSchema>;

export {
  requestItemsDraftSchema,
  requestLessonDraftSchema,
  requestRegisterNotesDraftSchema,
};
export type {
  RequestItemsDraft,
  RequestLessonDraft,
  RequestRegisterNotesDraft,
} from '@english-saas/shared';

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

export const COMMENT_TARGETS = ['VERSION', 'STEP', 'ITEM', 'AUDIO'] as const;
export const commentTargetSchema = z.enum(COMMENT_TARGETS);
export type CommentTarget = z.infer<typeof commentTargetSchema>;

export const AUDIO_ISSUE_KINDS = [
  'PRONUNCIATION',
  'INTONATION',
  'SPEED',
  'NOISE',
  'OTHER',
] as const;
export const audioIssueKindSchema = z.enum(AUDIO_ISSUE_KINDS);
export type AudioIssueKind = z.infer<typeof audioIssueKindSchema>;

export const commentSchema = z.object({
  id: z.string(),
  target: commentTargetSchema,
  /** Ordem da etapa, id da questão ou chave do áudio, conforme o `target`. */
  targetRef: z.string().nullable(),
  body: z.string(),
  audioIssue: audioIssueKindSchema.nullable(),
  /** A resposta de criar não traz estes três. */
  resolvedAt: z.string().nullable().optional(),
  resolvedById: z.string().nullable().optional(),
  author: z.object({ id: z.string(), name: z.string().nullable() }).optional(),
  createdAt: z.string(),
});
export type Comment = z.infer<typeof commentSchema>;
export const commentListSchema = z.array(commentSchema);

export const addCommentRequestSchema = z.object({
  target: commentTargetSchema,
  targetRef: z.string().max(120).nullable().optional(),
  audioIssue: audioIssueKindSchema.optional(),
  body: z.string().max(2_000),
});
export type AddCommentRequest = z.infer<typeof addCommentRequestSchema>;

export const resolvedCommentSchema = z.object({
  id: z.string(),
  resolvedAt: z.string().nullable(),
  resolvedById: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Áudio
// ---------------------------------------------------------------------------

export const audioTargetKindSchema = z.enum([
  'SCENE_LINE',
  'ITEM',
  'REGISTER_NOTE',
]);
export type AudioTargetKind = z.infer<typeof audioTargetKindSchema>;

export const audioTargetSchema = z.object({
  /** `scene:0:2`, `item:<uuid>`, `note:<slug>` — estável, serve de alvo. */
  key: z.string(),
  kind: audioTargetKindSchema,
  text: z.string(),
  /** Quem fala, o enunciado da questão ou o id da nota. */
  label: z.string().nullable(),
  stepOrder: z.number().nullable(),
  lineIndex: z.number().nullable(),
  itemId: z.string().nullable(),
  registerNoteId: z.string().nullable(),
  /** `null` = ainda sem áudio. A URL é assinada e vence. */
  audio: z
    .object({
      url: z.string(),
      mimeType: z.string(),
      durationMs: z.number().nullable(),
    })
    .nullable(),
  openIssues: z.array(
    z.object({
      id: z.string(),
      audioIssue: audioIssueKindSchema.nullable(),
      body: z.string(),
      createdAt: z.string(),
    }),
  ),
});
export type AudioTarget = z.infer<typeof audioTargetSchema>;

export const audioListSchema = z.object({
  versionStatus: contentStatusSchema,
  total: z.number(),
  /** Quantos ainda estão sem áudio: o publish só passa com 0. */
  pending: z.number(),
  targets: z.array(audioTargetSchema),
});
export type AudioList = z.infer<typeof audioListSchema>;

export const regenerateAudioRequestSchema = z.object({
  keys: z.array(z.string()).min(1).max(60),
  speakingRate: z.number().min(0.7).max(1.2).optional(),
});
export type RegenerateAudioRequest = z.infer<
  typeof regenerateAudioRequestSchema
>;

// ---------------------------------------------------------------------------
// Jobs de mídia e apostilas
// ---------------------------------------------------------------------------

export const mediaJobStartedSchema = z.object({
  jobId: z.string().nullable(),
  queue: z.string(),
});
export type MediaJobStarted = z.infer<typeof mediaJobStartedSchema>;

export const MEDIA_JOB_STATES = [
  'waiting',
  'active',
  'completed',
  'failed',
  'unknown',
] as const;
export const mediaJobSchema = z.object({
  id: z.string(),
  state: z.enum(MEDIA_JOB_STATES),
  failedReason: z.string().nullable(),
});
export type MediaJob = z.infer<typeof mediaJobSchema>;

export const workbookRowSchema = z.object({
  unit: z.object({ id: z.string(), slug: z.string(), title: z.string() }),
  cefrLevel: cefrLevelSchema,
  /** Lições publicadas: sem nenhuma, não há o que pôr no PDF. */
  publishedLessons: z.number(),
  workbook: z
    .object({
      id: z.string(),
      status: contentStatusSchema,
      generatedAt: z.string().nullable(),
      sizeBytes: z.number().nullable(),
      /** URL assinada; vence. */
      url: z.string().nullable(),
      /** O conteúdo publicado mudou depois do PDF. */
      stale: z.boolean(),
    })
    .nullable(),
});
export type WorkbookRow = z.infer<typeof workbookRowSchema>;
export const workbookRowListSchema = z.array(workbookRowSchema);
