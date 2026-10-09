import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as service from './service';
import type { AuditPage } from './schemas';

const PAGE_SIZE = 30;

export type AuditLogFilter = Omit<service.AuditFilter, 'cursor' | 'limit'>;

/** Mais recente primeiro; "carregar mais" pelo cursor. */
export function useAuditLog(filter: AuditLogFilter = {}) {
  return useInfiniteQuery<AuditPage, ApiError, InfiniteData<AuditPage>>({
    queryKey: queryKeys.adminAudit(filter),
    queryFn: ({ pageParam }) =>
      service.listAuditLog({
        limit: PAGE_SIZE,
        ...filter,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
