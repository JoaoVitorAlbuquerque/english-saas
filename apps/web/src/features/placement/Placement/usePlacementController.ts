import {
  useAnswerPlacement,
  usePlacementLatest,
  useStartPlacement,
  type PlacementState,
} from '@english-saas/api-client';
import type { AnswerResponse } from '@english-saas/shared';
import type { ItemAnswerPayload, ItemView } from '@english-saas/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildDontKnowResponse } from './dont-know-response';
import { toItemView } from './item-mapping';

/**
 * Uma tela, um estado. `GET /placement/latest` só é usado para descobrir de
 * onde partir ao montar (nunca fez → intro; teste aberto → retoma direto na
 * questão, sem passar pela intro; concluído → resultado). Depois disso, o
 * estado local é a fonte da verdade, atualizado pelo retorno de cada
 * mutation — não dependo de `setQueryData` limpar o erro 404 da query.
 */
export function usePlacementController() {
  const latest = usePlacementLatest();
  const start = useStartPlacement();
  const answer = useAnswerPlacement();
  const navigate = useNavigate();

  const [state, setState] = useState<PlacementState | null>(null);
  const syncedFromLatest = useRef(false);

  useEffect(() => {
    if (!syncedFromLatest.current && latest.data !== undefined) {
      setState(latest.data);
      syncedFromLatest.current = true;
    }
  }, [latest.data]);

  const currentItemId = state?.next?.id ?? null;
  const clientAnswerIdRef = useRef(crypto.randomUUID());
  const questionStartedAtRef = useRef(Date.now());

  useEffect(() => {
    clientAnswerIdRef.current = crypto.randomUUID();
    questionStartedAtRef.current = Date.now();
  }, [currentItemId]);

  async function begin() {
    const result = await start.mutateAsync();
    setState(result);
  }

  async function submit(response: AnswerResponse, responseTimeMs: number) {
    if (state === null || state.next === null) {
      return;
    }

    const result = await answer.mutateAsync({
      testId: state.id,
      itemId: state.next.id,
      response,
      responseTimeMs,
      clientAnswerId: clientAnswerIdRef.current,
    });

    setState(result);
  }

  function handleAnswer(payload: ItemAnswerPayload) {
    void submit(payload.response, payload.responseTimeMs);
  }

  function handleDontKnow(item: ItemView) {
    const responseTimeMs = Date.now() - questionStartedAtRef.current;
    void submit(buildDontKnowResponse(item), responseTimeMs);
  }

  function goToToday() {
    navigate('/hoje');
  }

  const neverTaken = latest.isError && latest.error.code === 'NOT_FOUND';

  return {
    isLoading: latest.isLoading,
    isLoadError: latest.isError && !neverTaken,
    retryLoad: () => void latest.refetch(),
    needsIntro: state === null && neverTaken,
    state,
    currentItem: state?.next ? toItemView(state.next) : null,
    onBegin: () => void begin(),
    isBeginning: start.isPending,
    beginError: start.error,
    onAnswer: handleAnswer,
    onDontKnow: handleDontKnow,
    isSubmitting: answer.isPending,
    submitError: answer.error,
    goToToday,
  };
}
