import { useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as service from './service';
import type { AdminMetrics, MetricsRange } from './schemas';

/**
 * Métricas da plataforma. `range` ausente = o padrão da API (30 dias até
 * ontem). Troca de intervalo é outra chave, então não mistura dados.
 */
export function useAdminMetrics(range: MetricsRange | null) {
  return useQuery<AdminMetrics, ApiError>({
    queryKey: queryKeys.adminMetrics(range),
    queryFn: () => service.getMetrics(range ?? undefined),
    // Vêm de tabelas diárias: mudam uma vez por dia.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
