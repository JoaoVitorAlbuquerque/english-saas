import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type PollableJob = {
  status: JobStatus;
};

export type UsePollJobOptions<T extends PollableJob> = {
  queryKey: readonly unknown[];
  fetchJob: () => Promise<T>;
  schema: z.ZodType<T>;
  enabled?: boolean;
  /** Intervalo inicial e teto do backoff exponencial, em ms. */
  intervalMs?: number;
  maxIntervalMs?: number;
};

const DONE_STATUSES: JobStatus[] = ['DONE', 'FAILED'];

/**
 * Acompanha um job assíncrono (correção, geração de material) por polling
 * com backoff — cresce enquanto o job segue em andamento, para assim que ele
 * termina. Pronto para os módulos de tutor/generator plugarem a função de
 * busca real.
 */
export function usePollJob<T extends PollableJob>({
  queryKey,
  fetchJob,
  schema,
  enabled = true,
  intervalMs = 1500,
  maxIntervalMs = 10_000,
}: UsePollJobOptions<T>) {
  return useQuery({
    queryKey,
    queryFn: async () => schema.parse(await fetchJob()),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;

      if (!data || DONE_STATUSES.includes(data.status)) {
        return false;
      }

      const attempts = query.state.dataUpdateCount;

      return Math.min(intervalMs * 2 ** attempts, maxIntervalMs);
    },
  });
}
