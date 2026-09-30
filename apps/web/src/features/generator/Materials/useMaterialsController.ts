import { useMaterials, useProfile } from '@english-saas/api-client';

import { levelEvolution } from '../lib/level-evolution';

export function useMaterialsController() {
  const materials = useMaterials();
  const profile = useProfile();
  const list = materials.data?.pages.flatMap((page) => page.data) ?? [];

  return {
    isLoading: materials.isLoading,
    isError: materials.isError,
    retry: () => void materials.refetch(),
    materials: list,
    // Evolução do que já carregou — a lista pagina do mais novo para trás.
    evolution: levelEvolution(list),
    timeZone: profile.data?.timezone,
    hasMore: materials.hasNextPage,
    loadMore: () => void materials.fetchNextPage(),
    isLoadingMore: materials.isFetchingNextPage,
  };
}
