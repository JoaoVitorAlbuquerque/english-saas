import { useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as learningService from './service';
import type { LearningStats, LessonHistoryPage } from './schemas';

export function useStats() {
  return useQuery<LearningStats, ApiError>({
    queryKey: queryKeys.meStats,
    queryFn: () => learningService.getStats(),
  });
}

/** Status (concluída/em andamento) de cada lição, pro catálogo decorar. */
export function useLessonHistory() {
  return useQuery<LessonHistoryPage['data'], ApiError>({
    queryKey: queryKeys.meHistory,
    queryFn: () => learningService.getRecentHistory(),
  });
}
