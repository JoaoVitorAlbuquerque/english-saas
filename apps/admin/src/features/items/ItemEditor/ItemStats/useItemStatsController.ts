import {
  type ApiError,
  useItemStats,
  useResolveFlaggedItem,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../../messages/pt-BR';

export function useItemStatsController(
  itemId: string | null,
  onResolved?: () => void,
) {
  const stats = useItemStats(itemId);
  const resolve = useResolveFlaggedItem();
  const [resolveError, setResolveError] = useState<string | null>(null);

  return {
    isLoading: stats.isPending && itemId !== null,
    error: stats.error,
    stats: stats.data,
    retry: () => void stats.refetch(),
    isResolving: resolve.isPending,
    resolveError,
    resolve: () => {
      if (itemId === null) {
        return;
      }

      setResolveError(null);
      resolve.mutate(itemId, {
        onSuccess: () => {
          toast.success({ title: t('items.stats.resolvedToast') });
          onResolved?.();
        },
        onError: (error: ApiError) =>
          setResolveError(error.message || t('items.stats.resolveError')),
      });
    },
  };
}
