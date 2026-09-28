import type { ApiError, PlacementState } from '@english-saas/api-client';
import {
  Button,
  ItemRenderer,
  ProgressBar,
  type ItemAnswerPayload,
  type ItemView,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

export function QuestionView({
  state,
  currentItem,
  onAnswer,
  onDontKnow,
  isSubmitting,
  submitError,
}: {
  state: PlacementState;
  currentItem: ItemView;
  onAnswer: (payload: ItemAnswerPayload) => void;
  onDontKnow: (item: ItemView) => void;
  isSubmitting: boolean;
  submitError: ApiError | null;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-ground p-4">
      <ProgressBar
        value={state.answered}
        max={state.maxItems}
        label={`Questão ${String(state.answered + 1)}`}
      />

      <ItemRenderer
        key={currentItem.id}
        item={currentItem}
        mode="assessment"
        onAnswer={onAnswer}
        disabled={isSubmitting}
      />

      {submitError ? (
        <p role="alert" className="text-sm text-error">
          {submitError.message}
        </p>
      ) : null}

      <Button
        variant="ghost"
        disabled={isSubmitting}
        onClick={() => onDontKnow(currentItem)}
      >
        {t('placement.question.dontKnow')}
      </Button>
    </div>
  );
}
