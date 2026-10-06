import {
  type AdminRegisterNote,
  type ApiError,
  useDeprecateRegisterNote,
  useRegisterNoteList,
} from '@english-saas/api-client';
import type { CefrLevel, RegisterLevel } from '@english-saas/shared';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { useDebouncedValue } from '../../curriculum/lib/useDebouncedValue';

export type NoteFilters = {
  q: string;
  level: CefrLevel | '';
  register: RegisterLevel | '';
  showObsolete: boolean;
};

const NO_FILTERS: NoteFilters = {
  q: '',
  level: '',
  register: '',
  showObsolete: false,
};

export function useRegisterNotesController() {
  const [filters, setFilters] = useState<NoteFilters>(NO_FILTERS);
  const debouncedQ = useDebouncedValue(filters.q.trim());
  const list = useRegisterNoteList({
    ...(debouncedQ === '' ? {} : { q: debouncedQ }),
    ...(filters.level === '' ? {} : { level: filters.level }),
    ...(filters.register === '' ? {} : { register: filters.register }),
    includeDeprecated: filters.showObsolete,
  });

  // `undefined`: fechado; `null`: criando; nota: editando.
  const [dialog, setDialog] = useState<AdminRegisterNote | null | undefined>(
    undefined,
  );
  const [deprecating, setDeprecating] = useState<AdminRegisterNote | null>(
    null,
  );
  const [replacement, setReplacement] = useState('');
  const [deprecateError, setDeprecateError] = useState<string | null>(null);
  const deprecate = useDeprecateRegisterNote();

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

  const hasFilters =
    filters.q !== '' ||
    filters.level !== '' ||
    filters.register !== '' ||
    filters.showObsolete;

  return {
    filters,
    setFilter: <K extends keyof NoteFilters>(key: K, value: NoteFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    clearFilters: () => setFilters(NO_FILTERS),
    hasFilters,
    isLoading: list.isPending,
    error: list.error,
    retry: () => void list.refetch(),
    notes: list.data?.pages.flatMap((page) => page.data) ?? [],
    hasMore: list.hasNextPage,
    isLoadingMore: list.isFetchingNextPage,
    loadMore: () => void list.fetchNextPage(),
    dialog,
    openCreate: () => setDialog(null),
    openEdit: (note: AdminRegisterNote) => setDialog(note),
    closeDialog: () => setDialog(undefined),
    deprecating,
    openDeprecate: (note: AdminRegisterNote) => setDeprecating(note),
    closeDeprecate,
    replacement,
    setReplacement,
    deprecateError,
    isDeprecating: deprecate.isPending,
    confirmDeprecate,
  };
}
