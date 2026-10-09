import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import type {
  CreditsBalance,
  CreditsHistoryPage,
  SubscriptionOverview,
} from '../billing/schemas';
import type { LessonHistoryPage } from '../learning/schemas';
import type { StudentProgress } from '../progress/schemas';
import * as service from './service';
import type {
  AdminAiUsage,
  AdminStudentOverview,
  AdminStudyPlan,
  AdminUserPage,
} from './schemas';

/**
 * Hooks da busca e da ficha de aluno (somente ADMIN). Cada seção da ficha é
 * uma query: a que falha não derruba as outras.
 */

const PAGE_SIZE = 25;

export function useAdminUsers(filter: { q?: string } = {}) {
  return useInfiniteQuery<AdminUserPage, ApiError, InfiniteData<AdminUserPage>>(
    {
      queryKey: queryKeys.adminUsers(filter),
      queryFn: ({ pageParam }) =>
        service.listUsers({
          limit: PAGE_SIZE,
          ...filter,
          ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    },
  );
}

/** Cada abertura da ficha entra na auditoria: sem refetch ao refocar a aba. */
export function useAdminStudent(id: string) {
  return useQuery<AdminStudentOverview, ApiError>({
    queryKey: queryKeys.adminStudentOverview(id),
    queryFn: () => service.getStudent(id),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });
}

export function useAdminStudentProgress(id: string, weeks: number) {
  return useQuery<StudentProgress, ApiError>({
    queryKey: queryKeys.adminStudentProgress(id, weeks),
    queryFn: () => service.getStudentProgress(id, weeks),
  });
}

export function useAdminStudentPlan(id: string) {
  return useQuery<AdminStudyPlan, ApiError>({
    queryKey: queryKeys.adminStudentPlan(id),
    queryFn: () => service.getStudentPlan(id),
  });
}

export function useAdminStudentHistory(id: string) {
  return useInfiniteQuery<
    LessonHistoryPage,
    ApiError,
    InfiniteData<LessonHistoryPage>
  >({
    queryKey: queryKeys.adminStudentHistory(id),
    queryFn: ({ pageParam }) =>
      service.getStudentHistory(
        id,
        typeof pageParam === 'string' ? pageParam : undefined,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useAdminStudentSubscription(id: string) {
  return useQuery<SubscriptionOverview, ApiError>({
    queryKey: queryKeys.adminStudentSubscription(id),
    queryFn: () => service.getStudentSubscription(id),
  });
}

export function useAdminStudentCredits(id: string) {
  return useQuery<CreditsBalance, ApiError>({
    queryKey: queryKeys.adminStudentCredits(id),
    queryFn: () => service.getStudentCredits(id),
  });
}

export function useAdminStudentCreditHistory(id: string) {
  return useInfiniteQuery<
    CreditsHistoryPage,
    ApiError,
    InfiniteData<CreditsHistoryPage>
  >({
    queryKey: queryKeys.adminStudentCreditHistory(id),
    queryFn: ({ pageParam }) =>
      service.getStudentCreditHistory(
        id,
        typeof pageParam === 'string' ? pageParam : undefined,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useAdminStudentAiUsage(id: string) {
  return useQuery<AdminAiUsage, ApiError>({
    queryKey: queryKeys.adminStudentAiUsage(id),
    queryFn: () => service.getStudentAiUsage(id),
  });
}
