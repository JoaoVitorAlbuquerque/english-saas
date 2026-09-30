import { useGenerationJob } from '@english-saas/api-client';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { toJobPhases } from '../lib/job-phases';
import { clearPendingJobId, savePendingJobId } from '../lib/pending-job';

/**
 * A URL é o estado: sair e voltar para `/ferramentas/pedidos/:jobId` retoma
 * o acompanhamento de onde estiver. Pronto, vai direto para o material.
 */
export function useGenerationJobController() {
  const navigate = useNavigate();
  const { jobId = '' } = useParams<{ jobId: string }>();
  const job = useGenerationJob(jobId);
  const data = job.data;

  const status = data?.status;
  const materialId = data?.materialId ?? null;
  const failed = status === 'FAILED' || status === 'REFUSED';

  useEffect(() => {
    if (status === undefined) return;

    if (status === 'QUEUED' || status === 'RUNNING') {
      savePendingJobId(jobId);
      return;
    }

    clearPendingJobId(jobId);

    if (status === 'DONE' && materialId !== null) {
      navigate(`/materiais/${materialId}`, { replace: true });
    }
  }, [status, materialId, jobId, navigate]);

  return {
    isLoading: job.isLoading,
    isError: job.isError,
    retry: () => void job.refetch(),
    phases: data === undefined ? [] : toJobPhases(data),
    message: data?.message ?? '',
    failed,
    materialId: status === 'DONE' ? materialId : null,
    // Tentar de novo volta para a tela do mesmo tipo de pedido.
    retryPath:
      data?.kind === 'INGEST' ? '/ferramentas/colar' : '/ferramentas/tema',
  };
}
