import { useAdminItemList, useFlaggedItems } from '@english-saas/api-client';
import type {
  CefrLevel,
  ContentStatus,
  ItemCalibrationFlag,
  ItemType,
} from '@english-saas/shared';
import { useMemo, useState } from 'react';

import { useDebouncedValue } from '../../curriculum/lib/useDebouncedValue';

export type ItemFilters = {
  q: string;
  status: ContentStatus | '';
  level: CefrLevel | '';
  type: ItemType | '';
  /** `HUMAN`, `AI_DRAFT` ou `AI_DRAFT_REVIEWED`. */
  source: string;
  skillId: string | null;
  /** Só os que a calibração marcou. */
  problematic: boolean;
  flag: ItemCalibrationFlag | '';
};

export const NO_ITEM_FILTERS: ItemFilters = {
  q: '',
  status: '',
  level: '',
  type: '',
  source: '',
  skillId: null,
  problematic: false,
  flag: '',
};

/** Uma linha da tabela, venha a lista do banco ou da fila de problemáticos. */
export type BankRow = {
  id: string;
  prompt: string;
  type: ItemType;
  cefrLevel: CefrLevel;
  status: ContentStatus;
  source: string;
  exposureCount: number;
  correctRate: number | null;
  difficulty: number;
  flags: ItemCalibrationFlag[];
};

export function useItemBankController() {
  const [filters, setFilters] = useState<ItemFilters>(NO_ITEM_FILTERS);
  const debouncedQ = useDebouncedValue(filters.q.trim());

  // A lista do banco só roda fora do modo "problemáticos".
  const list = useAdminItemList(
    {
      ...(debouncedQ === '' ? {} : { q: debouncedQ }),
      ...(filters.status === '' ? {} : { status: filters.status }),
      ...(filters.level === '' ? {} : { level: filters.level }),
      ...(filters.type === '' ? {} : { type: filters.type }),
      ...(filters.source === '' ? {} : { source: filters.source }),
      ...(filters.skillId === null ? {} : { skillId: filters.skillId }),
    },
    !filters.problematic,
  );

  // A fila de problemáticos mora no módulo 8: filtra por marca, nível e tipo.
  const flagged = useFlaggedItems(
    {
      ...(filters.flag === '' ? {} : { flag: filters.flag }),
      ...(filters.level === '' ? {} : { level: filters.level }),
      ...(filters.type === '' ? {} : { type: filters.type }),
    },
    filters.problematic,
  );

  // Todos os problemáticos conhecidos (mesmo sem filtro): é com eles que a
  // lista comum marca "problemático" ao lado do item.
  const everyFlagged = useFlaggedItems({}, !filters.problematic);
  const flagsById = useMemo(
    () =>
      new Map(
        (everyFlagged.data?.pages ?? []).flatMap((page) =>
          page.data.map((row) => [row.item.id, row.flags] as const),
        ),
      ),
    [everyFlagged.data],
  );

  const rows: BankRow[] = filters.problematic
    ? (flagged.data?.pages ?? []).flatMap((page) =>
        page.data.map((row) => ({
          id: row.item.id,
          prompt: row.item.prompt,
          type: row.item.type,
          cefrLevel: row.item.cefrLevel,
          status: row.item.status,
          source: row.item.source,
          exposureCount: row.item.exposureCount,
          correctRate: row.item.correctRate,
          difficulty: row.item.difficulty,
          flags: row.flags,
        })),
      )
    : (list.data?.pages ?? []).flatMap((page) =>
        page.data.map((item) => ({
          id: item.id,
          prompt: item.prompt,
          type: item.type,
          cefrLevel: item.cefrLevel,
          status: item.status,
          source: item.source,
          exposureCount: item.exposureCount,
          correctRate: item.correctRate,
          difficulty: item.difficulty,
          flags: flagsById.get(item.id) ?? [],
        })),
      );

  const active = filters.problematic ? flagged : list;

  const hasFilters =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.level !== '' ||
    filters.type !== '' ||
    filters.source !== '' ||
    filters.skillId !== null ||
    filters.problematic ||
    filters.flag !== '';

  return {
    filters,
    setFilter: <K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    clearFilters: () => setFilters(NO_ITEM_FILTERS),
    hasFilters,
    isLoading: active.isPending,
    error: active.error,
    retry: () => void active.refetch(),
    rows,
    hasMore: active.hasNextPage,
    isLoadingMore: active.isFetchingNextPage,
    loadMore: () => void active.fetchNextPage(),
  };
}
