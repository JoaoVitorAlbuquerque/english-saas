import { useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as plannerService from './service';
import type { StudyPlan } from './schemas';

/** 404 `NOT_FOUND` quando o aluno ainda não tem plano — a tela ignora e não mostra "próxima lição". */
export function usePlan() {
  return useQuery<StudyPlan, ApiError>({
    queryKey: queryKeys.mePlan,
    queryFn: () => plannerService.getPlan(),
    retry: false,
  });
}
