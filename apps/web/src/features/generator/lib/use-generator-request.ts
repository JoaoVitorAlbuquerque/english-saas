import {
  ApiError,
  useCredits,
  useInterests,
  useProfile,
  type GenerationJob,
} from '@english-saas/api-client';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { savePendingJobId } from './pending-job';

export type RequestProblem =
  | { kind: 'insufficient-credits'; cost: number }
  | { kind: 'message'; message: string }
  | null;

/**
 * O que as duas telas de pedido (tema e conteúdo colado) têm em comum: a
 * trava do plano, o saldo, o fuso do aluno, o `clientRequestId` estável por
 * pedido (reenviar em rede ruim não cobra duas vezes) e o que fazer com o
 * job criado ou com o erro.
 */
export function useGeneratorRequest(
  feature: 'GENERATOR_TOPIC' | 'GENERATOR_INGEST',
) {
  const navigate = useNavigate();
  const credits = useCredits();
  const profile = useProfile();
  const interests = useInterests();
  const requestIds = useRef(new Map<string, string>());

  const cost = credits.data?.costs[feature] ?? 5;

  /** O mesmo pedido (mesma chave) reaproveita o id até dar certo. */
  function clientRequestIdFor(key: string): string {
    const existing = requestIds.current.get(key);
    if (existing !== undefined) return existing;

    const created = crypto.randomUUID();
    requestIds.current.set(key, created);
    return created;
  }

  function openJob(job: GenerationJob, key: string): void {
    requestIds.current.delete(key);
    savePendingJobId(job.id);
    navigate(`/ferramentas/pedidos/${job.id}`);
  }

  function problemOf(error: unknown): RequestProblem {
    if (!(error instanceof ApiError)) {
      return error ? { kind: 'message', message: String(error) } : null;
    }

    if (error.code === 'INSUFFICIENT_AI_CREDITS') {
      const details = error.details as { cost?: unknown } | undefined;
      return {
        kind: 'insufficient-credits',
        cost: typeof details?.cost === 'number' ? details.cost : cost,
      };
    }

    return { kind: 'message', message: error.message };
  }

  return {
    isGateLoading: credits.isLoading,
    isGateError: credits.isError,
    retryGate: () => void credits.refetch(),
    isPlus: credits.data?.tier === 'PLUS',
    credits: credits.data ?? null,
    timeZone: profile.data?.timezone,
    interests: interests.data ?? [],
    cost,
    /** Depois de um 402, o saldo mostrado precisa ser o de agora. */
    refreshCredits: () => void credits.refetch(),
    clientRequestIdFor,
    openJob,
    problemOf,
  };
}
