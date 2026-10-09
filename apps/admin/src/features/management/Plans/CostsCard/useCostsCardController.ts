import { useCreditCosts } from '@english-saas/api-client';

export function useCostsCardController() {
  const query = useCreditCosts();

  return {
    costs: query.data?.costs,
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
