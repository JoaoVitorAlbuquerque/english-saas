import { useMutation, useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as placementService from './service';
import type { PlacementAnswerRequest, PlacementState } from './schemas';

/** 404 `NOT_FOUND` quando o aluno nunca fez o teste — a tela lê `error.code`. */
export function usePlacementLatest() {
  return useQuery<PlacementState, ApiError>({
    queryKey: queryKeys.placementLatest,
    queryFn: () => placementService.latest(),
  });
}

export function useStartPlacement() {
  return useMutation<PlacementState, ApiError, void>({
    mutationFn: () => placementService.start(),
  });
}

export function useAnswerPlacement() {
  return useMutation<
    PlacementState,
    ApiError,
    { testId: string } & PlacementAnswerRequest
  >({
    mutationFn: ({ testId, ...input }) =>
      placementService.answer(testId, input),
  });
}
