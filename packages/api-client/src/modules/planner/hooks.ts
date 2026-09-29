import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as plannerService from './service';
import type {
  CompleteBlockRequest,
  DailyAgenda,
  ForecastStatus,
  RebuildPlanRequest,
  SkipBlockRequest,
  StudyPlan,
} from './schemas';

/** 404 `NOT_FOUND` quando o aluno ainda não tem plano — a tela mostra o estado vazio. */
export function usePlan() {
  return useQuery<StudyPlan, ApiError>({
    queryKey: queryKeys.mePlan,
    queryFn: () => plannerService.getPlan(),
    retry: false,
  });
}

export function useRebuildPlan() {
  const queryClient = useQueryClient();

  return useMutation<StudyPlan, ApiError, RebuildPlanRequest | void>({
    mutationFn: (input) => plannerService.rebuildPlan(input ?? {}),
    onSuccess: (plan) => {
      queryClient.setQueryData(queryKeys.mePlan, plan);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.mePlanForecast,
      });
    },
  });
}

export function useForecast() {
  return useQuery<ForecastStatus, ApiError>({
    queryKey: queryKeys.mePlanForecast,
    queryFn: () => plannerService.getForecast(),
    retry: false,
  });
}

export function useAgenda() {
  return useQuery<DailyAgenda, ApiError>({
    queryKey: queryKeys.meAgenda,
    queryFn: () => plannerService.getAgenda(),
  });
}

export function useSkipAgendaBlock() {
  const queryClient = useQueryClient();

  return useMutation<
    DailyAgenda,
    ApiError,
    { blockId: string; input?: SkipBlockRequest }
  >({
    mutationFn: ({ blockId, input }) =>
      plannerService.skipAgendaBlock(blockId, input),
    onSuccess: (agenda) => {
      queryClient.setQueryData(queryKeys.meAgenda, agenda);
    },
  });
}

export function useCompleteAgendaBlock() {
  const queryClient = useQueryClient();

  return useMutation<
    DailyAgenda,
    ApiError,
    { blockId: string; input?: CompleteBlockRequest }
  >({
    mutationFn: ({ blockId, input }) =>
      plannerService.completeAgendaBlock(blockId, input),
    onSuccess: (agenda) => {
      queryClient.setQueryData(queryKeys.meAgenda, agenda);
    },
  });
}
