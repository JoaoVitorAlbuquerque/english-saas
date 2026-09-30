import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import { usePollJob } from '../../query/use-poll-job';
import * as billingService from './service';
import {
  subscriptionOverviewSchema,
  type CheckoutRequest,
  type CreditsBalance,
  type CreditsHistoryPage,
  type PlanView,
  type SubscriptionOverview,
} from './schemas';

export function usePlans() {
  return useQuery<PlanView[], ApiError>({
    queryKey: queryKeys.plans,
    queryFn: () => billingService.getPlans(),
  });
}

export function useSubscription() {
  return useQuery<SubscriptionOverview, ApiError>({
    queryKey: queryKeys.meSubscription,
    queryFn: () => billingService.getSubscription(),
  });
}

/**
 * Acompanha `GET /me/subscription` por polling até `isDone` — a tela de
 * checkout usa duas vezes: esperar o link de pagamento existir, e depois
 * esperar o status sair de PENDING.
 */
export function usePollSubscription(
  isDone: (overview: SubscriptionOverview) => boolean,
  enabled = true,
) {
  return usePollJob({
    queryKey: queryKeys.meSubscription,
    fetchJob: () => billingService.getSubscription(),
    schema: subscriptionOverviewSchema,
    enabled,
    isDone,
    intervalMs: 2_000,
    maxIntervalMs: 8_000,
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation<SubscriptionOverview, ApiError, CheckoutRequest>({
    mutationFn: (input) => billingService.checkout(input),
    onSuccess: (overview) => {
      queryClient.setQueryData(queryKeys.meSubscription, overview);
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation<SubscriptionOverview, ApiError, void>({
    mutationFn: () => billingService.cancelSubscription(),
    onSuccess: (overview) => {
      queryClient.setQueryData(queryKeys.meSubscription, overview);
    },
  });
}

export function useCredits() {
  return useQuery<CreditsBalance, ApiError>({
    queryKey: queryKeys.meCredits,
    queryFn: () => billingService.getCredits(),
  });
}

export function useCreditsHistory() {
  return useQuery<CreditsHistoryPage, ApiError>({
    queryKey: queryKeys.meCreditsHistory,
    queryFn: () => billingService.getCreditsHistory({ limit: 30 }),
  });
}
