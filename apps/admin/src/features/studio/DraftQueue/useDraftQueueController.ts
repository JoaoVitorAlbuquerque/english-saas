import {
  useDiscardDraft,
  useDrafts,
  type ApiError,
  type Draft,
} from '@english-saas/api-client';
import type { DraftKind, DraftStatus } from '@english-saas/shared';
import { toast } from '@english-saas/ui';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';

export const ACTIVE_STATUSES: readonly DraftStatus[] = [
  'QUEUED',
  'GENERATING',
  'QA_RUNNING',
];

export type DraftFilters = { status: DraftStatus | ''; kind: DraftKind | '' };

export function useDraftQueueController() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<DraftFilters>({
    status: '',
    kind: '',
  });
  const [discarding, setDiscarding] = useState<Draft | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useDrafts({
    ...(filters.status === '' ? {} : { status: filters.status }),
    ...(filters.kind === '' ? {} : { kind: filters.kind }),
  });
  const discard = useDiscardDraft();

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  function confirmDiscard(): void {
    if (discarding === null) {
      return;
    }

    discard.mutate(discarding.id, {
      onSuccess: () => toast.success({ title: t('studio.queue.discarded') }),
      onError: (error: ApiError) =>
        toast.error({
          title: t('studio.queue.discardError'),
          description: error.message,
        }),
      onSettled: () => setDiscarding(null),
    });
  }

  return {
    filters,
    setFilter: <K extends keyof DraftFilters>(key: K, value: DraftFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    hasFilters: filters.status !== '' || filters.kind !== '',
    clearFilters: () => setFilters({ status: '', kind: '' }),
    rows,
    /** O pedido recém-criado (`?novo=<id>`): a linha vem destacada. */
    highlightedId: searchParams.get('novo'),
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
    refresh: () => void query.refetch(),
    isRefreshing: query.isFetching && !query.isPending,
    hasActive: rows.some((draft) => ACTIVE_STATUSES.includes(draft.status)),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    discarding,
    requestDiscard: setDiscarding,
    cancelDiscard: () => setDiscarding(null),
    confirmDiscard,
    isDiscarding: discard.isPending,
    expanded,
    toggleExpanded: (id: string) =>
      setExpanded((current) => (current === id ? null : id)),
  };
}
