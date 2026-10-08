import type { DraftKind, DraftStatus } from '@english-saas/shared';

import { ApiError } from '../../http/api-error';
import { apiFetch } from '../../http/fetch-client';
import { withQuery } from '../../http/with-query';
import {
  addCommentRequestSchema,
  audioListSchema,
  commentListSchema,
  commentSchema,
  draftEstimateSchema,
  draftPageSchema,
  draftSchema,
  mediaJobSchema,
  mediaJobStartedSchema,
  qaReportSchema,
  regenerateAudioRequestSchema,
  requestItemsDraftSchema,
  requestLessonDraftSchema,
  requestRegisterNotesDraftSchema,
  resolvedCommentSchema,
  workbookRowListSchema,
  type AddCommentRequest,
  type AudioList,
  type Comment,
  type Draft,
  type DraftEstimate,
  type DraftPage,
  type MediaJob,
  type MediaJobStarted,
  type QaReport,
  type RegenerateAudioRequest,
  type RequestItemsDraft,
  type RequestLessonDraft,
  type RequestRegisterNotesDraft,
  type WorkbookRow,
} from './schemas';

const BASE = '/admin/content-studio';

// --- Rascunhos ---

export type DraftFilter = {
  cursor?: string;
  limit?: number;
  status?: DraftStatus;
  kind?: DraftKind;
};

export async function listDrafts(filter: DraftFilter = {}): Promise<DraftPage> {
  return apiFetch(withQuery(`${BASE}/drafts`, filter), {
    schema: draftPageSchema,
  });
}

export async function getDraft(id: string): Promise<Draft> {
  return apiFetch(`${BASE}/drafts/${id}`, { schema: draftSchema });
}

/** Pede à IA: responde 202 com o rascunho em `QUEUED`. */
export async function requestLessonDraft(
  input: RequestLessonDraft,
): Promise<Draft> {
  return apiFetch(`${BASE}/drafts/lesson`, {
    method: 'POST',
    body: requestLessonDraftSchema.parse(input),
    schema: draftSchema,
  });
}

export async function requestItemsDraft(
  input: RequestItemsDraft,
): Promise<Draft> {
  return apiFetch(`${BASE}/drafts/items`, {
    method: 'POST',
    body: requestItemsDraftSchema.parse(input),
    schema: draftSchema,
  });
}

export async function requestRegisterNotesDraft(
  input: RequestRegisterNotesDraft,
): Promise<Draft> {
  return apiFetch(`${BASE}/drafts/register-notes`, {
    method: 'POST',
    body: requestRegisterNotesDraftSchema.parse(input),
    schema: draftSchema,
  });
}

/** Descarta e arquiva o que o rascunho criou. */
export async function discardDraft(id: string): Promise<Draft> {
  return apiFetch(`${BASE}/drafts/${id}/discard`, {
    method: 'POST',
    schema: draftSchema,
  });
}

export async function estimateDraft(
  kind: DraftKind,
  count: number,
): Promise<DraftEstimate> {
  return apiFetch(withQuery(`${BASE}/drafts/estimate`, { kind, count }), {
    schema: draftEstimateSchema,
  });
}

// --- Revisão automática ---

/** Último relatório da versão, ou `null` se a revisão nunca rodou (404). */
export async function getQaReport(
  lessonVersionId: string,
): Promise<QaReport | null> {
  try {
    return await apiFetch(`${BASE}/qa/lesson-versions/${lessonVersionId}`, {
      schema: qaReportSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

/** Roda de novo, **dentro do request** (inclui uma chamada de IA: demora). */
export async function runQa(lessonVersionId: string): Promise<QaReport> {
  return apiFetch(`${BASE}/qa/lesson-versions/${lessonVersionId}`, {
    method: 'POST',
    schema: qaReportSchema,
  });
}

// --- Comentários ---

export async function listComments(
  lessonVersionId: string,
  includeResolved = false,
): Promise<Comment[]> {
  return apiFetch(
    withQuery(`${BASE}/lesson-versions/${lessonVersionId}/comments`, {
      includeResolved,
    }),
    { schema: commentListSchema },
  );
}

export async function addComment(
  lessonVersionId: string,
  input: AddCommentRequest,
): Promise<Comment> {
  return apiFetch(`${BASE}/lesson-versions/${lessonVersionId}/comments`, {
    method: 'POST',
    body: addCommentRequestSchema.parse(input),
    schema: commentSchema,
  });
}

export async function resolveComment(id: string) {
  return apiFetch(`${BASE}/comments/${id}/resolve`, {
    method: 'POST',
    schema: resolvedCommentSchema,
  });
}

// --- Áudio ---

export async function getAudio(lessonVersionId: string): Promise<AudioList> {
  return apiFetch(`${BASE}/lesson-versions/${lessonVersionId}/audio`, {
    schema: audioListSchema,
  });
}

/** Gera de novo as falas escolhidas (202; acompanhe pelo job). */
export async function regenerateAudio(
  lessonVersionId: string,
  input: RegenerateAudioRequest,
): Promise<MediaJobStarted> {
  return apiFetch(
    `${BASE}/lesson-versions/${lessonVersionId}/audio/regenerate`,
    {
      method: 'POST',
      body: regenerateAudioRequestSchema.parse(input),
      schema: mediaJobStartedSchema,
    },
  );
}

// --- Apostilas e jobs ---

export async function listWorkbooks(): Promise<WorkbookRow[]> {
  return apiFetch(`${BASE}/workbooks`, { schema: workbookRowListSchema });
}

export async function regenerateWorkbook(
  unitId: string,
): Promise<MediaJobStarted> {
  return apiFetch(`${BASE}/units/${unitId}/workbook`, {
    method: 'POST',
    schema: mediaJobStartedSchema,
  });
}

export async function getMediaJob(id: string): Promise<MediaJob> {
  return apiFetch(`${BASE}/jobs/${id}`, { schema: mediaJobSchema });
}
