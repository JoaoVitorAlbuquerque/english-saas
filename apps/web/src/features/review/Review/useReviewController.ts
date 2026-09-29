import {
  useAnswerReviewCard,
  useCompleteAgendaBlock,
  useReviewSession,
} from '@english-saas/api-client';
import type { ReviewAnswerResult } from '@english-saas/api-client';
import type { ItemAnswerPayload } from '@english-saas/ui';
import { useEffect, useReducer, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { initialReviewState, reduceReview } from './review-reducer';

type RouteState = { agendaBlockId?: string } | null;

/**
 * Orquestra a revisão: escolhe os minutos, carrega a sessão, responde item
 * ou flashcard por vez, e ao terminar marca o bloco `REVIEW` da agenda de
 * hoje como concluído (se foi de lá que o aluno veio — `location.state`).
 */
export function useReviewController() {
  const navigate = useNavigate();
  const location = useLocation();
  const agendaBlockId = (location.state as RouteState)?.agendaBlockId ?? null;

  const [state, dispatch] = useReducer(reduceReview, initialReviewState);
  const [isExitDialogOpen, setExitDialogOpen] = useState(false);
  const [remainingDue, setRemainingDue] = useState<number | null>(null);
  const [itemFeedback, setItemFeedback] = useState<ReviewAnswerResult | null>(
    null,
  );

  const session = useReviewSession(state.minutes ?? 0, state.minutes !== null);
  const answerCard = useAnswerReviewCard();
  const completeAgendaBlock = useCompleteAgendaBlock();
  const remainingSession = useReviewSession(120, state.phase === 'SUMMARY');

  useEffect(() => {
    if (state.phase !== 'LOADING') {
      return;
    }

    if (session.isSuccess) {
      dispatch({ type: 'SESSION_LOADED', cards: session.data });
    }

    if (session.isError) {
      dispatch({ type: 'LOAD_FAILED', message: session.error.message });
    }
  }, [
    state.phase,
    session.isSuccess,
    session.isError,
    session.data,
    session.error,
  ]);

  useEffect(() => {
    if (state.phase !== 'SUMMARY') {
      return;
    }

    if (agendaBlockId !== null) {
      completeAgendaBlock.mutate({
        blockId: agendaBlockId,
        input: { minutesSpent: state.minutes ?? undefined },
      });
    }

    if (remainingSession.isSuccess) {
      setRemainingDue(remainingSession.data.length);
    }
    // Só quando a sessão termina — as mutations/queries acima não precisam
    // reexecutar isto a cada render delas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, remainingSession.isSuccess, remainingSession.data]);

  const currentCard = state.cards[state.currentIndex] ?? null;

  function pickMinutes(minutes: number): void {
    dispatch({ type: 'MINUTES_PICKED', minutes });
  }

  function flipCard(): void {
    dispatch({ type: 'CARD_FLIPPED' });
  }

  function onAnswerItem(itemId: string, payload: ItemAnswerPayload): void {
    if (currentCard === null) {
      return;
    }

    answerCard.mutate(
      {
        cardId: currentCard.cardId,
        input: {
          kind: 'ITEM',
          itemId,
          response: payload.response,
          responseTimeMs: payload.responseTimeMs,
          hintsUsed: payload.hintsUsed,
        },
      },
      { onSuccess: (result) => setItemFeedback(result) },
    );
  }

  function continueAfterItem(): void {
    if (itemFeedback === null) {
      return;
    }
    dispatch({ type: 'ANSWER_RECEIVED', result: itemFeedback });
    setItemFeedback(null);
  }

  function selfRate(selfRating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'): void {
    if (currentCard === null) {
      return;
    }

    answerCard.mutate(
      {
        cardId: currentCard.cardId,
        input: { kind: 'SELF_RATING', selfRating },
      },
      {
        onSuccess: (result) => dispatch({ type: 'ANSWER_RECEIVED', result }),
      },
    );
  }

  function restart(): void {
    dispatch({ type: 'RESTARTED' });
    setRemainingDue(null);
    setItemFeedback(null);
  }

  function openExitDialog(): void {
    setExitDialogOpen(true);
  }

  function closeExitDialog(): void {
    setExitDialogOpen(false);
  }

  function confirmExit(): void {
    setExitDialogOpen(false);
    navigate('/hoje');
  }

  return {
    phase: state.phase,
    minutes: state.minutes,
    cards: state.cards,
    currentIndex: state.currentIndex,
    currentCard,
    flipped: state.flipped,
    reviewedCount: state.reviewedCount,
    dueDates: state.dueDates,
    loadError: state.error,
    isLoading: state.phase === 'LOADING',
    pickMinutes,
    flipCard,
    onAnswerItem,
    itemFeedback,
    continueAfterItem,
    isAnswering: answerCard.isPending,
    selfRate,
    restart,
    remainingDue,
    isExitDialogOpen,
    openExitDialog,
    closeExitDialog,
    confirmExit,
  };
}
