import { AUDIT_ACTIONS, useAuditLog } from '@english-saas/api-client';
import { useMemo, useState } from 'react';

import { localDayBounds } from '../lib/period';

export type AuditFilters = { action: string; from: string; to: string };

const EMPTY: AuditFilters = { action: '', from: '', to: '' };

export function useAuditLogController() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY);

  // O servidor guarda instantes UTC; o filtro vale pelo dia **de quem olha**.
  const query = useAuditLog({
    ...(filters.action === '' ? {} : { action: filters.action }),
    ...(filters.from === '' ? {} : { from: localDayBounds(filters.from).from }),
    ...(filters.to === '' ? {} : { to: localDayBounds(filters.to).to }),
  });

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );
  const hasFilters =
    filters.action !== '' || filters.from !== '' || filters.to !== '';

  return {
    filters,
    actions: AUDIT_ACTIONS,
    setFilter: <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    hasFilters,
    clearFilters: () => setFilters(EMPTY),
    rows,
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}
