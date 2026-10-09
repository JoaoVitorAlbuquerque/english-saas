import type { ApiError } from '@english-saas/api-client';

/** O que um controller devolve para cada parte carregada à parte. */
export type SectionData<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: ApiError | null;
  retry: () => void;
};

export function toSection<T>(query: {
  data: T | undefined;
  isPending: boolean;
  error: ApiError | null;
  refetch: () => unknown;
}): SectionData<T> {
  return {
    data: query.data,
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
