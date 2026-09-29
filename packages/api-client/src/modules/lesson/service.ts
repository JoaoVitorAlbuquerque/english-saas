import { apiFetch } from '../../http/fetch-client';
import {
  attemptViewSchema,
  catalogLessonSchema,
  completeStepRequestSchema,
  completionResultSchema,
  startAttemptResponseSchema,
  type AttemptView,
  type CatalogLesson,
  type CompleteStepRequest,
  type CompletionResult,
  type StartAttemptResponse,
} from './schemas';

export async function getLesson(slug: string): Promise<CatalogLesson> {
  return apiFetch(`/catalog/lessons/${encodeURIComponent(slug)}`, {
    schema: catalogLessonSchema,
  });
}

export async function startAttempt(
  lessonId: string,
): Promise<StartAttemptResponse> {
  return apiFetch(`/lessons/${lessonId}/attempts`, {
    method: 'POST',
    body: {},
    schema: startAttemptResponseSchema,
  });
}

export async function completeStep(
  attemptId: string,
  stepIndex: number,
  input: CompleteStepRequest,
): Promise<AttemptView> {
  const body = completeStepRequestSchema.parse(input);

  return apiFetch(`/attempts/${attemptId}/steps/${stepIndex}/complete`, {
    method: 'POST',
    body,
    schema: attemptViewSchema,
  });
}

export async function completeAttempt(
  attemptId: string,
): Promise<CompletionResult> {
  return apiFetch(`/attempts/${attemptId}/complete`, {
    method: 'POST',
    schema: completionResultSchema,
  });
}
