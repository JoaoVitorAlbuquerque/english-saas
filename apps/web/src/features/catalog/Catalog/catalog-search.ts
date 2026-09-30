import type { CatalogUnit } from '@english-saas/api-client';
import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Não existe campo de tema em `Unit` nem busca no backend — o curso é
 * pequeno, então filtramos no cliente por título e sinopse.
 */
export function filterUnitsByText(
  units: CatalogUnit[],
  query: string,
): CatalogUnit[] {
  const needle = normalize(query);

  if (needle === '') {
    return units;
  }

  return units.filter((unit) => {
    const haystack = normalize(`${unit.title} ${unit.synopsis ?? ''}`);
    return haystack.includes(needle);
  });
}

export type UnitGroup = { level: CefrLevel; units: CatalogUnit[] };

/** Agrupa por nível, na ordem A1 → C1, e descarta níveis sem unidade. */
export function groupUnitsByLevel(units: CatalogUnit[]): UnitGroup[] {
  return CEFR_LEVELS.flatMap((level) => {
    const inLevel = units.filter((unit) => unit.level.cefrLevel === level);
    return inLevel.length === 0 ? [] : [{ level, units: inLevel }];
  });
}
