import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as srsService from './service';
import type {
  ReviewAnswerRequest,
  ReviewAnswerResult,
  SessionCard,
} from './schemas';

export function useReviewSession(minutes: number, enabled = true) {
  return useQuery<SessionCard[], ApiError>({
    queryKey: queryKeys.reviewSession(minutes),
    queryFn: () => srsService.getReviewSession(minutes),
    enabled,
  });
}

/** Responde um card. Também alimenta a sequência (o backend registra o dia). */
export function useAnswerReviewCard() {
  const queryClient = useQueryClient();

  return useMutation<
    ReviewAnswerResult,
    ApiError,
    { cardId: string; input: ReviewAnswerRequest }
  >({
    mutationFn: ({ cardId, input }) =>
      srsService.answerReviewCard(cardId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meStats });
    },
  });
}
