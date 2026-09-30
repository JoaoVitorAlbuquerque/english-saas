import {
  useAnswerMaterialItem,
  useMaterial,
  useRateMaterial,
  useSetTermInReview,
  type AnswerResult,
  type MaterialDetail,
  type MaterialDifficulty,
} from '@english-saas/api-client';
import type { Span } from '@english-saas/shared';
import type { ItemAnswerPayload } from '@english-saas/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

export type RateOption = 'LIKED' | 'TOO_EASY' | 'TOO_HARD';

/**
 * As três opções da tela viram o contrato da API (nota 1–5 + dificuldade).
 * "Gostei" é nota alta (vira sinal de interesse no modelo do aluno); os
 * "demais" ficam na nota neutra — dizem do nível, não do assunto.
 */
const RATE_BODY: Record<
  RateOption,
  { rating: number; difficulty: MaterialDifficulty }
> = {
  LIKED: { rating: 5, difficulty: 'OK' },
  TOO_EASY: { rating: 3, difficulty: 'TOO_EASY' },
  TOO_HARD: { rating: 3, difficulty: 'TOO_HARD' },
};

function rateOptionOf(feedback: MaterialDetail['feedback']): RateOption | null {
  if (feedback.rating === null) return null;
  if (feedback.difficulty === 'TOO_EASY') return 'TOO_EASY';
  if (feedback.difficulty === 'TOO_HARD') return 'TOO_HARD';
  return 'LIKED';
}

export function useMaterialController() {
  const { materialId = '' } = useParams<{ materialId: string }>();
  const material = useMaterial(materialId);
  const answerItem = useAnswerMaterialItem(materialId);
  const rate = useRateMaterial(materialId);
  const setTermInReview = useSetTermInReview(materialId);

  const [answers, setAnswers] = useState<Record<string, AnswerResult>>({});
  const [answerErrorItemId, setAnswerErrorItemId] = useState<string | null>(
    null,
  );
  const [chosenRate, setChosenRate] = useState<RateOption | null>(null);

  const data = material.data;
  const explanations = new Map(
    (data?.content.spans ?? []).map((span) => [
      `${String(span.start)}:${String(span.end)}`,
      span.explanationPtBr,
    ]),
  );

  function answer(itemId: string, payload: ItemAnswerPayload): void {
    if (answerItem.isPending) return;

    setAnswerErrorItemId(null);
    answerItem.mutate(
      { itemId, ...payload },
      {
        onSuccess: (result) =>
          setAnswers((current) => ({ ...current, [itemId]: result })),
        onError: () => setAnswerErrorItemId(itemId),
      },
    );
  }

  return {
    isLoading: material.isLoading,
    isError: material.isError,
    retry: () => void material.refetch(),
    material: data ?? null,

    explanationFor: (span: Span) =>
      explanations.get(`${String(span.start)}:${String(span.end)}`) ?? null,

    answers,
    answeringItemId: answerItem.isPending
      ? (answerItem.variables?.itemId ?? null)
      : null,
    answerErrorItemId,
    answer,

    toggleTerm: (termKey: string, inReview: boolean) =>
      setTermInReview.mutate({ termKey, inReview }),
    pendingTermKey: setTermInReview.isPending
      ? (setTermInReview.variables?.termKey ?? null)
      : null,

    // O que o aluno tocou aparece na hora; se falhar, volta ao salvo.
    rateOption: chosenRate ?? (data ? rateOptionOf(data.feedback) : null),
    rateSaved: rate.isSuccess,
    isRating: rate.isPending,
    rateMaterial: (option: RateOption) => {
      setChosenRate(option);
      rate.mutate(RATE_BODY[option], { onError: () => setChosenRate(null) });
    },
  };
}
