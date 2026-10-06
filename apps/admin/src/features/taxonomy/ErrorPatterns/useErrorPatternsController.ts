import {
  type AdminErrorPattern,
  type ApiError,
  useDeprecateErrorPattern,
  useErrorPatternList,
} from '@english-saas/api-client';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { useDebouncedValue } from '../../curriculum/lib/useDebouncedValue';

export function useErrorPatternsController() {
  const [q, setQ] = useState('');
  const [showObsolete, setShowObsolete] = useState(false);
  const debouncedQ = useDebouncedValue(q.trim());
  const list = useErrorPatternList({
    ...(debouncedQ === '' ? {} : { q: debouncedQ }),
    includeDeprecated: showObsolete,
  });

  // `undefined`: fechado; `null`: criando; erro típico: editando.
  const [dialog, setDialog] = useState<AdminErrorPattern | null | undefined>(
    undefined,
  );
  const [deprecating, setDeprecating] = useState<AdminErrorPattern | null>(
    null,
  );
  const [replacement, setReplacement] = useState('');
  const [deprecateError, setDeprecateError] = useState<string | null>(null);
  const deprecate = useDeprecateErrorPattern();

  function closeDeprecate(): void {
    setDeprecating(null);
    setReplacement('');
    setDeprecateError(null);
  }

  function confirmDeprecate(): void {
    if (deprecating === null) {
      return;
    }

    setDeprecateError(null);
    deprecate.mutate(
      {
        id: deprecating.id,
        replacedById: replacement === '' ? null : replacement,
      },
      {
        onSuccess: closeDeprecate,
        onError: (error: ApiError) =>
          setDeprecateError(error.message || t('taxonomy.deprecate.error')),
      },
    );
  }

  return {
    q,
    setQ,
    showObsolete,
    setShowObsolete,
    hasFilters: q !== '' || showObsolete,
    clearFilters: () => {
      setQ('');
      setShowObsolete(false);
    },
    isLoading: list.isPending,
    error: list.error,
    retry: () => void list.refetch(),
    patterns: list.data?.pages.flatMap((page) => page.data) ?? [],
    hasMore: list.hasNextPage,
    isLoadingMore: list.isFetchingNextPage,
    loadMore: () => void list.fetchNextPage(),
    dialog,
    openCreate: () => setDialog(null),
    openEdit: (pattern: AdminErrorPattern) => setDialog(pattern),
    closeDialog: () => setDialog(undefined),
    deprecating,
    openDeprecate: (pattern: AdminErrorPattern) => setDeprecating(pattern),
    closeDeprecate,
    replacement,
    setReplacement,
    deprecateError,
    isDeprecating: deprecate.isPending,
    confirmDeprecate,
  };
}
