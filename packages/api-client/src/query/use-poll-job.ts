import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type PollableJob = {
  status: JobStatus;
};

const DONE_STATUSES: JobStatus[] = ['DONE', 'FAILED'];

export type UsePollJobOptions<T> = {
  queryKey: readonly unknown[];
  fetchJob: () => Promise<T>;
  schema: z.ZodType<T>;
  enabled?: boolean;
  /**
   * Quando o job já terminou (sucesso ou falha) e o polling pode parar.
   * Por padrão, assume o `status` genérico (`PENDING/PROCESSING/DONE/FAILED`)
   * — cada módulo com seus próprios nomes de status (tutor: `QUEUED`,
   * `TRANSCRIBING`...) passa o seu próprio.
   */
  isDone?: (job: T) => boolean;
  /** Intervalo inicial e teto do backoff exponencial, em ms. */
  intervalMs?: number;
  maxIntervalMs?: number;
};

function defaultIsDone(job: unknown): boolean {
  return (
    typeof job === 'object' &&
    job !== null &&
    'status' in job &&
    DONE_STATUSES.includes((job as PollableJob).status)
  );
}

/**
 * Acompanha um job assíncrono (correção, roleplay, geração de material) por
 * polling com backoff — cresce enquanto o job segue em andamento, para assim
 * que ele termina.
 */
export function usePollJob<T>({
  queryKey,
  fetchJob,
  schema,
  enabled = true,
  isDone = defaultIsDone,
  intervalMs = 1500,
  maxIntervalMs = 10_000,
}: UsePollJobOptions<T>) {
  return useQuery({
    queryKey,
    queryFn: async () => schema.parse(await fetchJob()),
    enabled,
    // O default global (30s) faria a primeira checagem depois de montar —
    // ou depois de uma mutation escrever no mesmo cache — esperar até o
    // cache "envelhecer" em vez de checar na hora. Polling sempre quer dado
    // fresco.
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data;

      if (!data || isDone(data)) {
        return false;
      }

      const attempts = query.state.dataUpdateCount;

      return Math.min(intervalMs * 2 ** attempts, maxIntervalMs);
    },
  });
}
