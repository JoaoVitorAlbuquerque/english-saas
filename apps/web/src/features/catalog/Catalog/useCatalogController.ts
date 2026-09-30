import { useUnits } from '@english-saas/api-client';
import type { CefrLevel } from '@english-saas/shared';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { filterUnitsByText, groupUnitsByLevel } from './catalog-search';

export function useCatalogController() {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel | undefined>(
    undefined,
  );
  const [search, setSearch] = useState('');
  const units = useUnits(selectedLevel);

  const groups = useMemo(() => {
    const filtered = filterUnitsByText(units.data ?? [], search);
    return groupUnitsByLevel(filtered);
  }, [units.data, search]);

  function openUnit(slug: string) {
    navigate(`/unidades/${slug}`);
  }

  return {
    selectedLevel,
    onSelectLevel: setSelectedLevel,
    search,
    onSearchChange: setSearch,
    isLoading: units.isLoading,
    isError: units.isError,
    retry: () => void units.refetch(),
    groups,
    hasAnyUnit: (units.data ?? []).length > 0,
    openUnit,
  };
}
