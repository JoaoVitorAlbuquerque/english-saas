import {
  useCorrectionPoll,
  useCreateCorrection,
  type ApiError,
} from '@english-saas/api-client';
import { FreeProductionView } from '@english-saas/ui';
import type { FreeProductionContent } from '@english-saas/shared';
import { useState } from 'react';

export type FreeProductionStepProps = {
  content: FreeProductionContent;
  lessonId: string;
  stepIndex: number;
  /** Conclui a etapa com o texto do aluno — só depois de ele ver a correção. */
  onContinue: (text: string) => void;
};

/**
 * A tela é `FreeProductionView` (packages/ui, também usada no preview do
 * admin); aqui ficam só a correção por IA, o polling e o saldo de créditos.
 */
export function FreeProductionStep({
  content,
  lessonId,
  stepIndex,
  onContinue,
}: FreeProductionStepProps) {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [creditsExhausted, setCreditsExhausted] = useState(false);

  const createCorrection = useCreateCorrection();
  const correction = useCorrectionPoll(correctionId);

  function handleSubmit(text: string): void {
    if (hasSubmitted) {
      return;
    }

    setHasSubmitted(true);

    createCorrection
      .mutateAsync({ lessonId, stepIndex, text })
      .then((view) => setCorrectionId(view.id))
      .catch((error: ApiError) => {
        if (error.code === 'INSUFFICIENT_AI_CREDITS') {
          setCreditsExhausted(true);
        }
      });
  }

  const result = correction.data?.result ?? null;
  const isPending =
    correction.data === undefined ||
    correction.data.status === 'QUEUED' ||
    correction.data.status === 'TRANSCRIBING';

  return (
    <FreeProductionView
      prompt={content.prompt}
      helpers={content.helpers}
      minWords={content.minWords}
      submitted={hasSubmitted}
      isCorrecting={hasSubmitted && !creditsExhausted && isPending}
      creditsExhausted={creditsExhausted}
      result={result}
      notice={
        correction.data && !result && !isPending
          ? correction.data.message
          : null
      }
      onSubmit={handleSubmit}
      onContinue={onContinue}
    />
  );
}
