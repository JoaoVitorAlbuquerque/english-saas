import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import type { PlanView } from '../billing/schemas';
import * as service from './service';
import type {
  CreditCostsResponse,
  CreditFeatureName,
  GrantBonus,
  GrantBonusResponse,
  UpdatePlan,
} from './schemas';

function invalidateAudit(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditAll });
}

export function useAdminPlans() {
  return useQuery<PlanView[], ApiError>({
    queryKey: queryKeys.adminPlans,
    queryFn: () => service.listPlans(),
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation<PlanView, ApiError, { id: string; patch: UpdatePlan }>({
    mutationFn: ({ id, patch }) => service.updatePlan(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminPlans });
      // Plano mudado reflete no que o aluno vê (vitrine, cota).
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans });
      invalidateAudit(queryClient);
    },
  });
}

export function useCreditCosts() {
  return useQuery<CreditCostsResponse, ApiError>({
    queryKey: queryKeys.adminCreditCosts,
    queryFn: () => service.getCreditCosts(),
  });
}

export function useUpdateCreditCost() {
  const queryClient = useQueryClient();

  return useMutation<
    CreditCostsResponse,
    ApiError,
    { feature: CreditFeatureName; cost: number }
  >({
    mutationFn: ({ feature, cost }) => service.updateCreditCost(feature, cost),
    onSuccess: (costs) => {
      queryClient.setQueryData(queryKeys.adminCreditCosts, costs);
      invalidateAudit(queryClient);
    },
  });
}

/** Saldo, extrato e auditoria da ficha atualizam sozinhos. */
export function useGrantBonus(userId: string) {
  const queryClient = useQueryClient();

  return useMutation<GrantBonusResponse, ApiError, GrantBonus>({
    mutationFn: (input) => service.grantBonus(userId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.adminStudentCredits(userId),
      });
      invalidateAudit(queryClient);
    },
  });
}
