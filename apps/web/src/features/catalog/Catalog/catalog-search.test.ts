import type { CatalogUnit } from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import { filterUnitsByText, groupUnitsByLevel } from './catalog-search';

function unit(overrides: Partial<CatalogUnit> = {}): CatalogUnit {
  return {
    id: 'unit-1',
    slug: 'a1-u1-new-neighbors',
    order: 1,
    title: 'New neighbors',
    synopsis: 'Lucas conhece a nova vizinha, Maya.',
    level: { cefrLevel: 'A1', title: 'Iniciante' },
    cover: null,
    cast: [],
    lessons: [],
    locked: false,
    requiredPlan: null,
    ...overrides,
  };
}

describe('filterUnitsByText', () => {
  it('sem busca, devolve tudo', () => {
    expect(filterUnitsByText([unit()], '')).toHaveLength(1);
  });

  it('acha pelo título, ignorando acento e caixa', () => {
    expect(filterUnitsByText([unit()], 'NEIGHBORS')).toHaveLength(1);
  });

  it('acha pela sinopse', () => {
    expect(filterUnitsByText([unit()], 'vizinha')).toHaveLength(1);
  });

  it('não acha o que não bate', () => {
    expect(filterUnitsByText([unit()], 'restaurante')).toHaveLength(0);
  });
});

describe('groupUnitsByLevel', () => {
  it('agrupa na ordem A1 → C1, sem níveis vazios', () => {
    const groups = groupUnitsByLevel([
      unit({ id: 'u-b1', level: { cefrLevel: 'B1', title: 'Intermediário' } }),
      unit({ id: 'u-a1', level: { cefrLevel: 'A1', title: 'Iniciante' } }),
    ]);

    expect(groups.map((g) => g.level)).toEqual(['A1', 'B1']);
  });
});
