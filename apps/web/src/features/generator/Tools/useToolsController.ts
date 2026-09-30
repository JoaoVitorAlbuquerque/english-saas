import {
  FINAL_GENERATION_STATUSES,
  useCredits,
  useGenerationJob,
} from '@english-saas/api-client';
import { useEffect, useState } from 'react';

import { clearPendingJobId, readPendingJobId } from '../lib/pending-job';

export function useToolsController() {
  const credits = useCredits();
  const [pendingJobId] = useState(readPendingJobId);
  const pendingJob = useGenerationJob(pendingJobId);
  const pendingFinished =
    pendingJob.data !== undefined &&
    FINAL_GENERATION_STATUSES.includes(pendingJob.data.status);

  // Pedido que terminou (ou sumiu) enquanto o aluno estava fora: o atalho
  // de "retomar" não faz mais sentido.
  useEffect(() => {
    if (pendingJobId !== null && (pendingFinished || pendingJob.isError)) {
      clearPendingJobId(pendingJobId);
    }
  }, [pendingJobId, pendingFinished, pendingJob.isError]);

  const costs = credits.data?.costs ?? {};

  return {
    isLoading: credits.isLoading,
    isError: credits.isError,
    retry: () => void credits.refetch(),
    isPlus: credits.data?.tier === 'PLUS',
    balance: credits.data?.balance ?? 0,
    topicCost: costs['GENERATOR_TOPIC'] ?? 5,
    ingestCost: costs['GENERATOR_INGEST'] ?? 5,
    pendingJobId:
      pendingJobId !== null && pendingJob.data !== undefined && !pendingFinished
        ? pendingJobId
        : null,
  };
}
