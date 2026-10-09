import { useAdminUsers } from '@english-saas/api-client';
import { useMemo, useState } from 'react';

import { useDebouncedValue } from '../../curriculum/lib/useDebouncedValue';

export function useStudentsController() {
  const [text, setText] = useState('');
  // A busca só vai ao servidor quando a digitação dá uma pausa.
  const q = useDebouncedValue(text.trim(), 300);
  const query = useAdminUsers(q === '' ? {} : { q });

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  return {
    text,
    setText,
    /** O termo que de fato foi buscado. */
    searched: q,
    clearSearch: () => setText(''),
    rows,
    isLoading: query.isPending,
    /** Digitou, mas a resposta ainda é da busca anterior. */
    isSearching: text.trim() !== q || (query.isFetching && !query.isPending),
    error: query.error,
    retry: () => void query.refetch(),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}
