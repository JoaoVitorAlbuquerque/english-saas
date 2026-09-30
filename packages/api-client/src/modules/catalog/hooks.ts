import type { CefrLevel } from '@english-saas/shared';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as catalogService from './service';
import type {
  CatalogLevel,
  CatalogUnit,
  CatalogWorkbook,
  WorkbookFile,
} from './schemas';

export function useLevels() {
  return useQuery<CatalogLevel[], ApiError>({
    queryKey: queryKeys.catalogLevels,
    queryFn: () => catalogService.getLevels(),
  });
}

export function useUnits(level?: CefrLevel) {
  return useQuery<CatalogUnit[], ApiError>({
    queryKey: queryKeys.catalogUnits(level),
    queryFn: () => catalogService.getAllUnits(level),
  });
}

export function useUnit(slug: string) {
  return useQuery<CatalogUnit, ApiError>({
    queryKey: queryKeys.catalogUnit(slug),
    queryFn: () => catalogService.getUnit(slug),
  });
}

export function useWorkbooks(level?: CefrLevel) {
  return useQuery<CatalogWorkbook[], ApiError>({
    queryKey: queryKeys.catalogWorkbooks(level),
    queryFn: () => catalogService.getWorkbooks({ level }),
  });
}

/** Busca o link assinado só quando o aluno clica em baixar. */
export function useWorkbookFile() {
  return useMutation<WorkbookFile, ApiError, string>({
    mutationFn: (workbookId) => catalogService.getWorkbookFile(workbookId),
  });
}
