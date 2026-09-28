import {
  createOfflineQueue,
  useCompleteAttempt,
  useCompleteStep,
  useLesson,
  useStartAttempt,
  useSubmitAnswer,
  type AnswerResult,
  type AttemptView,
  type CompleteStepRequest,
  type SubmitAnswerRequest,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import type { ItemAnswerPayload } from '@english-saas/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useLessonStore } from './lesson-store';

type OfflineAction =
  | {
      kind: 'completeStep';
      attemptId: string;
      stepIndex: number;
      input: CompleteStepRequest;
    }
  | { kind: 'answer'; input: SubmitAnswerRequest };

type OfflineResult =
  | { kind: 'completeStep'; attempt: AttemptView }
  | { kind: 'answer'; result: AnswerResult };

/**
 * Orquestra o player: carrega a lição e a tentativa (inicia ou retoma
 * sozinho), guarda tudo no `lesson-store` (reducer puro por trás) e envolve
 * `completeStep`/`answers` numa fila offline — os dois são idempotentes no
 * back-end, então reexecutar depois que a conexão volta é seguro.
 */
export function useLessonController() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const state = useLessonStore();
  const dispatch = useLessonStore((store) => store.dispatch);

  const lessonQuery = useLesson(slug);
  const startAttempt = useStartAttempt();
  const completeStepMutation = useCompleteStep();
  const completeAttemptMutation = useCompleteAttempt();
  const submitAnswerMutation = useSubmitAnswer();

  const startedRef = useRef(false);
  const stepStartedAtRef = useRef(Date.now());
  const clientAnswerIdRef = useRef(crypto.randomUUID());
  // `useState` inicializador: garante que `createOfflineQueue` (que já
  // registra o listener de `online` como efeito colateral) rode uma única
  // vez, mesmo que o componente rerenderize antes do primeiro efeito.
  const [queue] = useState(() =>
    createOfflineQueue<OfflineAction, OfflineResult>({
      storageKey: 'lesson-offline-queue',
      execute: async (action) => {
        if (action.kind === 'completeStep') {
          const attempt = await completeStepMutation.mutateAsync({
            attemptId: action.attemptId,
            stepIndex: action.stepIndex,
            input: action.input,
          });
          return { kind: 'completeStep', attempt };
        }

        const result = await submitAnswerMutation.mutateAsync(action.input);
        return { kind: 'answer', result };
      },
    }),
  );

  useEffect(() => {
    return () => queue.stop();
  }, [queue]);

  useEffect(() => {
    if (lessonQuery.data) {
      dispatch({ type: 'LESSON_LOADED', lesson: lessonQuery.data });
    }
  }, [lessonQuery.data, dispatch]);

  useEffect(() => {
    if (lessonQuery.data && !startedRef.current) {
      startedRef.current = true;
      startAttempt
        .mutateAsync(lessonQuery.data.id)
        .then((attempt) => dispatch({ type: 'ATTEMPT_LOADED', attempt }))
        .catch(() => {
          dispatch({
            type: 'ERROR_RAISED',
            message: 'Não conseguimos começar esta lição agora.',
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonQuery.data]);

  useEffect(() => {
    stepStartedAtRef.current = Date.now();
    clientAnswerIdRef.current = crypto.randomUUID();
  }, [state.currentStepIndex]);

  function timeSpentMs(): number {
    return Date.now() - stepStartedAtRef.current;
  }

  async function completeStep(response?: { text: string }): Promise<void> {
    if (state.attempt === null) {
      return;
    }

    const stepIndex = state.currentStepIndex;
    const input: CompleteStepRequest = { timeSpentMs: timeSpentMs(), response };

    const outcome = await queue.run({
      kind: 'completeStep',
      attemptId: state.attempt.id,
      stepIndex,
      input,
    });

    if (outcome.status === 'queued') {
      toast.message({
        title: 'Sem conexão agora',
        description: 'Sua etapa foi salva e vai sincronizar sozinha.',
      });
      return;
    }

    if (outcome.result.kind === 'completeStep') {
      dispatch({ type: 'STEP_COMPLETED', attempt: outcome.result.attempt });
    }
  }

  async function submitAnswer(
    itemId: string,
    payload: ItemAnswerPayload,
  ): Promise<void> {
    if (state.attempt === null) {
      return;
    }

    const outcome = await queue.run({
      kind: 'answer',
      input: {
        itemId,
        attemptId: state.attempt.id,
        context: 'LESSON',
        response: payload.response,
        responseTimeMs: payload.responseTimeMs,
        hintsUsed: payload.hintsUsed,
        clientAnswerId: clientAnswerIdRef.current,
      },
    });

    if (outcome.status === 'queued') {
      toast.message({
        title: 'Sem conexão agora',
        description: 'Sua resposta foi salva e vai sincronizar sozinha.',
      });
      return;
    }

    if (outcome.result.kind === 'answer') {
      clientAnswerIdRef.current = crypto.randomUUID();
      dispatch({
        type: 'ANSWER_RECEIVED',
        itemId,
        result: outcome.result.result,
      });
    }
  }

  async function finishLesson(): Promise<void> {
    if (state.attempt === null) {
      return;
    }

    try {
      await completeStep();
      const result = await completeAttemptMutation.mutateAsync(
        state.attempt.id,
      );
      dispatch({ type: 'LESSON_COMPLETED', result });
    } catch {
      dispatch({
        type: 'ERROR_RAISED',
        message: 'Não conseguimos fechar a lição agora. Tenta de novo.',
      });
    }
  }

  async function restart(): Promise<void> {
    if (state.lesson === null) {
      return;
    }

    try {
      const attempt = await startAttempt.mutateAsync(state.lesson.id);
      dispatch({ type: 'RESTARTED', attempt });
    } catch {
      dispatch({
        type: 'ERROR_RAISED',
        message: 'Não conseguimos começar de novo agora.',
      });
    }
  }

  const [isExitDialogOpen, setExitDialogOpen] = useState(false);

  function exitLesson(): void {
    navigate('/hoje');
  }

  return {
    ...state,
    isLoading:
      lessonQuery.isLoading ||
      (lessonQuery.isSuccess && state.attempt === null),
    isLoadError: lessonQuery.isError,
    retryLoad: () => void lessonQuery.refetch(),
    onCompleteStep: (response?: { text: string }) =>
      void completeStep(response),
    onSubmitAnswer: (itemId: string, payload: ItemAnswerPayload) =>
      void submitAnswer(itemId, payload),
    onFinishLesson: () => void finishLesson(),
    isFinishingLesson: completeAttemptMutation.isPending,
    onRestart: () => void restart(),
    isRestarting: startAttempt.isPending,
    isExitDialogOpen,
    openExitDialog: () => setExitDialogOpen(true),
    closeExitDialog: () => setExitDialogOpen(false),
    confirmExit: () => {
      setExitDialogOpen(false);
      exitLesson();
    },
    goToToday: () => navigate('/hoje'),
  };
}
