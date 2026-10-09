import { useAdminPlans } from '@english-saas/api-client';

export function usePlansController() {
  const query = useAdminPlans();

  return {
    plans: query.data ?? [],
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
