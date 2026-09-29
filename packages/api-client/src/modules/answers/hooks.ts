import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as answersService from './service';
import type { AnswerResult, SubmitAnswerRequest } from './schemas';

/** Toda resposta registra o dia de estudo (sequência) no backend. */
export function useSubmitAnswer() {
  const queryClient = useQueryClient();

  return useMutation<AnswerResult, ApiError, SubmitAnswerRequest>({
    mutationFn: (input) => answersService.submitAnswer(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meStats });
    },
  });
}
