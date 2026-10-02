import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import { applyPreferencesPatch } from './apply-patch';
import * as notificationsService from './service';
import type {
  NotificationPreferences,
  PushSubscriptionRequest,
  PushTestResponse,
  PushUnsubscribeRequest,
  UpdatePreferencesRequest,
} from './schemas';

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences, ApiError>({
    queryKey: queryKeys.meNotificationPreferences,
    queryFn: () => notificationsService.getPreferences(),
  });
}

/**
 * Interruptor que salva ao mudar: a tela já mostra o valor novo (otimista) e
 * volta ao anterior se o servidor recusar — ex.: 422 de hora dentro do
 * silencioso. A resposta do servidor é a verdade e substitui o palpite.
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation<
    NotificationPreferences,
    ApiError,
    UpdatePreferencesRequest,
    { previous: NotificationPreferences | undefined }
  >({
    mutationFn: (input) => notificationsService.updatePreferences(input),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.meNotificationPreferences,
      });
      const previous = queryClient.getQueryData<NotificationPreferences>(
        queryKeys.meNotificationPreferences,
      );

      if (previous !== undefined) {
        queryClient.setQueryData(
          queryKeys.meNotificationPreferences,
          applyPreferencesPatch(previous, patch),
        );
      }

      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          queryKeys.meNotificationPreferences,
          context.previous,
        );
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(
        queryKeys.meNotificationPreferences,
        preferences,
      );
    },
  });
}

export function usePushPublicKey() {
  return useMutation<{ publicKey: string }, ApiError, void>({
    mutationFn: () => notificationsService.getPushPublicKey(),
  });
}

export function useSubscribePush() {
  const queryClient = useQueryClient();

  return useMutation<
    NotificationPreferences,
    ApiError,
    PushSubscriptionRequest
  >({
    mutationFn: (input) => notificationsService.subscribePush(input),
    onSuccess: (preferences) => {
      queryClient.setQueryData(
        queryKeys.meNotificationPreferences,
        preferences,
      );
    },
  });
}

export function useUnsubscribePush() {
  const queryClient = useQueryClient();

  return useMutation<NotificationPreferences, ApiError, PushUnsubscribeRequest>(
    {
      mutationFn: (input) => notificationsService.unsubscribePush(input),
      onSuccess: (preferences) => {
        queryClient.setQueryData(
          queryKeys.meNotificationPreferences,
          preferences,
        );
      },
    },
  );
}

export function useTestPush() {
  return useMutation<PushTestResponse, ApiError, void>({
    mutationFn: () => notificationsService.testPush(),
  });
}
