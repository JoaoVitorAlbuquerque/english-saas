import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as lessonService from './service';
import type {
  AttemptView,
  CatalogLesson,
  CompleteStepRequest,
  CompletionResult,
  StartAttemptResponse,
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

/**
 * Concluir a lição soma XP e sequência, e o backend marca sozinho o bloco
 * LESSON da agenda de hoje (ver `AgendaService.completeLessonBlock`) — por
 * isso invalida os dois em vez de só devolver o resultado da mutation.
 */
export function useCompleteAttempt() {
  const queryClient = useQueryClient();

  return useMutation<CompletionResult, ApiError, string>({
    mutationFn: (attemptId) => lessonService.completeAttempt(attemptId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meStats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.meAgenda });
    },
  });
}
