import {
  useMediaJob,
  useRegenerateWorkbook,
  useStudioWorkbooks,
  type ApiError,
  type WorkbookRow,
} from '@english-saas/api-client';
import type { CefrLevel } from '@english-saas/shared';
import { useMemo, useState } from 'react';

export type WorkbookStatus =
  'NONE' | 'GENERATING' | 'FAILED' | 'STALE' | 'UP_TO_DATE';

export function useWorkbooksController() {
  const [level, setLevel] = useState<CefrLevel | ''>('');
  const query = useStudioWorkbooks();

  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (row) => level === '' || row.cefrLevel === level,
      ),
    [query.data, level],
  );

  return {
    level,
    setLevel,
    rows,
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
    refresh: () => void query.refetch(),
    isRefreshing: query.isFetching && !query.isPending,
  };
}

/** Gerar (de novo) a apostila de uma unidade e acompanhar o job até acabar. */
export function useWorkbookRowController(row: WorkbookRow) {
  const regenerate = useRegenerateWorkbook();
  const [jobId, setJobId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const job = useMediaJob(jobId);

  const jobState = job.data?.state;
  const running =
    regenerate.isPending ||
    (jobId !== null &&
      (jobState === undefined ||
        jobState === 'waiting' ||
        jobState === 'active'));
  const failed = jobState === 'failed';

  function start(): void {
    setRequestError(null);
    regenerate.mutate(row.unit.id, {
      onSuccess: (started) => setJobId(started.jobId),
      onError: (error: ApiError) => setRequestError(error.message),
    });
  }

  const status: WorkbookStatus = running
    ? 'GENERATING'
    : failed
      ? 'FAILED'
      : row.workbook === null
        ? 'NONE'
        : row.workbook.stale
          ? 'STALE'
          : 'UP_TO_DATE';

  return {
    status,
    running,
    failedReason: failed ? (job.data?.failedReason ?? null) : null,
    requestError,
    // Sem lição publicada não há o que pôr no PDF.
    canRegenerate: row.publishedLessons > 0 && !running,
    start,
  };
}
