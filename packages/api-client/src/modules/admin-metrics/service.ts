import { apiFetch } from '../../http/fetch-client';
import { withQuery } from '../../http/with-query';
import {
  adminMetricsSchema,
  type AdminMetrics,
  type MetricsRange,
} from './schemas';

/**
 * Sem `range`, a API devolve os 30 dias até ontem — e diz qual foi em
 * `period`, que é de onde o painel parte para os outros atalhos (7/90/180).
 */
export async function getMetrics(range?: MetricsRange): Promise<AdminMetrics> {
  return apiFetch(withQuery('/admin/metrics', { ...range }), {
    schema: adminMetricsSchema,
  });
}
