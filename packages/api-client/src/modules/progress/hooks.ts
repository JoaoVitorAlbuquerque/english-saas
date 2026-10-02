import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as progressService from './service';
import { PROGRESS_WEEKS_DEFAULT, type StudentProgress } from './schemas';

/**
 * Painel do aluno. Trocar o período mantém o desenho anterior na tela até o
 * novo chegar — os gráficos não piscam para o esqueleto a cada clique.
 */
export function useProgress(weeks: number = PROGRESS_WEEKS_DEFAULT) {
  return useQuery<StudentProgress, ApiError>({
    queryKey: queryKeys.meProgress(weeks),
    queryFn: () => progressService.getProgress(weeks),
    placeholderData: keepPreviousData,
  });
}
