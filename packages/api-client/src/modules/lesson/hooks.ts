import { useMutation, useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as lessonService from './service';
import type {
  AnswerResult,
  AttemptView,
  CatalogLesson,
  CompleteStepRequest,
  CompletionResult,
  StartAttemptResponse,
  SubmitAnswerRequest,
} from './schemas';

export function useLesson(slug: string, enabled = true) {
  return useQuery<CatalogLesson, ApiError>({
    queryKey: queryKeys.lesson(slug),
    queryFn: () => lessonService.getLesson(slug),
    enabled,
  });
}

export function useStartAttempt() {
  return useMutation<StartAttemptResponse, ApiError, string>({
    mutationFn: (lessonId) => lessonService.startAttempt(lessonId),
  });
}

export function useCompleteStep() {
  return useMutation<
    AttemptView,
    ApiError,
    { attemptId: string; stepIndex: number; input: CompleteStepRequest }
  >({
    mutationFn: ({ attemptId, stepIndex, input }) =>
      lessonService.completeStep(attemptId, stepIndex, input),
  });
}

export function useCompleteAttempt() {
  return useMutation<CompletionResult, ApiError, string>({
    mutationFn: (attemptId) => lessonService.completeAttempt(attemptId),
  });
}

export function useSubmitAnswer() {
  return useMutation<AnswerResult, ApiError, SubmitAnswerRequest>({
    mutationFn: (input) => lessonService.submitAnswer(input),
  });
}
