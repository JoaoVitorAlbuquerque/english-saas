import {
  type AdminSkill,
  type ApiError,
  useDeprecateSkill,
  useSkillList,
} from '@english-saas/api-client';
import type { CefrLevel, Competency, SkillType } from '@english-saas/shared';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { useDebouncedValue } from '../../curriculum/lib/useDebouncedValue';

export type SkillFilters = {
  q: string;
  level: CefrLevel | '';
  competency: Competency | '';
  type: SkillType | '';
  showObsolete: boolean;
};

const NO_FILTERS: SkillFilters = {
  q: '',
  level: '',
  competency: '',
  type: '',
  showObsolete: false,
};

export function useSkillsController() {
  const [filters, setFilters] = useState<SkillFilters>(NO_FILTERS);
  const debouncedQ = useDebouncedValue(filters.q.trim());
  const list = useSkillList({
    ...(debouncedQ === '' ? {} : { q: debouncedQ }),
    ...(filters.level === '' ? {} : { level: filters.level }),
    ...(filters.competency === '' ? {} : { competency: filters.competency }),
    ...(filters.type === '' ? {} : { type: filters.type }),
    includeDeprecated: filters.showObsolete,
  });

  // `undefined`: fechado; `null`: criando; skill: editando.
  const [dialog, setDialog] = useState<AdminSkill | null | undefined>(
    undefined,
  );
  const [deprecating, setDeprecating] = useState<AdminSkill | null>(null);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [deprecateError, setDeprecateError] = useState<string | null>(null);
  const deprecate = useDeprecateSkill();

  function closeDeprecate(): void {
    setDeprecating(null);
    setReplacement(null);
    setDeprecateError(null);
  }

  function confirmDeprecate(): void {
    if (deprecating === null) {
      return;
    }

    setDeprecateError(null);
    deprecate.mutate(
      { id: deprecating.id, replacedById: replacement },
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
    filters.competency !== '' ||
    filters.type !== '' ||
    filters.showObsolete;

  return {
    filters,
    setFilter: <K extends keyof SkillFilters>(key: K, value: SkillFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    clearFilters: () => setFilters(NO_FILTERS),
    hasFilters,
    isLoading: list.isPending,
    error: list.error,
    retry: () => void list.refetch(),
    skills: list.data?.pages.flatMap((page) => page.data) ?? [],
    hasMore: list.hasNextPage,
    isLoadingMore: list.isFetchingNextPage,
    loadMore: () => void list.fetchNextPage(),
    dialog,
    openCreate: () => setDialog(null),
    openEdit: (skill: AdminSkill) => setDialog(skill),
    closeDialog: () => setDialog(undefined),
    deprecating,
    openDeprecate: (skill: AdminSkill) => setDeprecating(skill),
    closeDeprecate,
    replacement,
    setReplacement,
    deprecateError,
    isDeprecating: deprecate.isPending,
    confirmDeprecate,
  };
}
