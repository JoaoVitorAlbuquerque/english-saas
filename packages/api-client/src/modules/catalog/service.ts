import type { CefrLevel } from '@english-saas/shared';

import { apiFetch } from '../../http/fetch-client';
import {
  catalogLevelSchema,
  catalogUnitSchema,
  catalogWorkbookSchema,
  paginatedUnitsSchema,
  workbookFileSchema,
  type CatalogLevel,
  type CatalogUnit,
  type CatalogWorkbook,
  type PaginatedUnits,
  type WorkbookFile,
} from './schemas';

export async function getLevels(): Promise<CatalogLevel[]> {
  return apiFetch('/catalog/levels', {
    schema: catalogLevelSchema.array(),
  });
}

export async function getUnits(query: {
  cursor?: string;
  limit?: number;
  level?: CefrLevel;
}): Promise<PaginatedUnits> {
  const params = new URLSearchParams();
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.level !== undefined) params.set('level', query.level);
  const qs = params.toString();

  return apiFetch(`/catalog/units${qs === '' ? '' : `?${qs}`}`, {
    schema: paginatedUnitsSchema,
  });
}

/**
 * Todas as unidades publicadas de um nível (ou de todos), em uma lista só —
 * o curso é pequeno (dezenas de unidades, não milhares, mesmo raciocínio do
 * planner), e a busca por título/sinopse do catálogo é feita no cliente, sem
 * endpoint de busca no backend.
 */
export async function getAllUnits(level?: CefrLevel): Promise<CatalogUnit[]> {
  const units: CatalogUnit[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await getUnits({ cursor, limit: 100, level });
    units.push(...page.data);

    if (!page.hasMore || page.nextCursor === null) {
      return units;
    }

    cursor = page.nextCursor;
  }
}

export async function getUnit(slug: string): Promise<CatalogUnit> {
  return apiFetch(`/catalog/units/${encodeURIComponent(slug)}`, {
    schema: catalogUnitSchema,
  });
}

export async function getWorkbooks(
  query: {
    level?: CefrLevel;
  } = {},
): Promise<CatalogWorkbook[]> {
  const qs = query.level === undefined ? '' : `?level=${query.level}`;

  return apiFetch(`/catalog/workbooks${qs}`, {
    schema: catalogWorkbookSchema.array(),
  });
}

export async function getWorkbookFile(id: string): Promise<WorkbookFile> {
  return apiFetch(`/catalog/workbooks/${id}/file`, {
    schema: workbookFileSchema,
  });
}
