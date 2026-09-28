import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import { usePollJob } from '../../query/use-poll-job';
import * as tutorService from './service';
import {
  correctionViewSchema,
  roleplayViewSchema,
  type CorrectionView,
  type CreateCorrectionRequest,
  type RoleplayTurnRequest,
  type RoleplayView,
  type StartRoleplayRequest,
} from './schemas';

const CORRECTION_DONE_STATUSES = ['DONE', 'REFUSED', 'FAILED'];

export function useCreateCorrection() {
  return useMutation<CorrectionView, ApiError, CreateCorrectionRequest>({
    mutationFn: (input) => tutorService.createCorrection(input),
  });
}

/** Acompanha a correção até `DONE`/`REFUSED`/`FAILED`. */
export function useCorrectionPoll(id: string | null) {
  return usePollJob<CorrectionView>({
    queryKey: queryKeys.correction(id ?? 'none'),
    fetchJob: () => tutorService.getCorrection(id as string),
    schema: correctionViewSchema,
    enabled: id !== null,
    isDone: (correction) =>
      CORRECTION_DONE_STATUSES.includes(correction.status),
  });
}

export function useStartRoleplay() {
  const queryClient = useQueryClient();

  return useMutation<RoleplayView, ApiError, StartRoleplayRequest>({
    mutationFn: (input) => tutorService.startRoleplay(input),
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.roleplay(view.id), view);
    },
  });
}

/** Acompanha a conversa enquanto houver um turno `PENDING` (fala do personagem chegando). */
export function useRoleplay(id: string | null) {
  return usePollJob<RoleplayView>({
    queryKey: queryKeys.roleplay(id ?? 'none'),
    fetchJob: () => tutorService.getRoleplay(id as string),
    schema: roleplayViewSchema,
    enabled: id !== null,
    isDone: (view) => !view.turns.some((turn) => turn.status === 'PENDING'),
  });
}

export function useSubmitRoleplayTurn() {
  const queryClient = useQueryClient();

  return useMutation<
    RoleplayView,
    ApiError,
    { id: string; input: RoleplayTurnRequest }
  >({
    mutationFn: ({ id, input }) => tutorService.submitRoleplayTurn(id, input),
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.roleplay(view.id), view);
      // `setQueryData` não religa o `refetchInterval` que já tinha parado
      // (sem turno pendente); o refetch recalcula e o polling volta.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.roleplay(view.id),
      });
    },
  });
}

export function useFinishRoleplay() {
  const queryClient = useQueryClient();

  return useMutation<RoleplayView, ApiError, string>({
    mutationFn: (id) => tutorService.finishRoleplay(id),
    onSuccess: (view) => {
      queryClient.setQueryData(queryKeys.roleplay(view.id), view);
    },
  });
}
