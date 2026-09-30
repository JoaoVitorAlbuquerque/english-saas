import {
  useAnswerCheckpoint,
  useStartCheckpoint,
  type CheckpointState,
} from '@english-saas/api-client';
import type { AnswerResponse } from '@english-saas/shared';
import type { ItemAnswerPayload } from '@english-saas/ui';
import { useRef, useState } from 'react';

export type CheckpointPhase = 'INTRO' | 'IN_PROGRESS' | 'RESULT';

export function useCheckpointController(unitId: string) {
  const start = useStartCheckpoint();
  const answer = useAnswerCheckpoint();
  const [state, setState] = useState<CheckpointState | null>(null);

  const clientAnswerIdRef = useRef(crypto.randomUUID());
  const questionStartedAtRef = useRef(Date.now());

  function resetAnswerTracking() {
    clientAnswerIdRef.current = crypto.randomUUID();
    questionStartedAtRef.current = Date.now();
  }

  async function begin() {
    const result = await start.mutateAsync(unitId);
    resetAnswerTracking();
    setState(result);
  }

  async function submit(response: AnswerResponse, responseTimeMs: number) {
    if (state?.next === null || state === undefined || state === null) {
      return;
    }

    const result = await answer.mutateAsync({
      checkpointId: state.id,
      input: {
        itemId: state.next.id,
        response,
        responseTimeMs,
        clientAnswerId: clientAnswerIdRef.current,
      },
    });

    resetAnswerTracking();
    setState(result);
  }

  function handleAnswer(payload: ItemAnswerPayload) {
    void submit(payload.response, payload.responseTimeMs);
  }

  const phase: CheckpointPhase =
    state === null
      ? 'INTRO'
      : state.status === 'COMPLETED'
        ? 'RESULT'
        : 'IN_PROGRESS';

  return {
    phase,
    state,
    onBegin: () => void begin(),
    isBeginning: start.isPending,
    beginError: start.error,
    onAnswer: handleAnswer,
    isSubmitting: answer.isPending,
    submitError: answer.error,
  };
}
