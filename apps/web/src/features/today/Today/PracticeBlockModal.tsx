import type { AgendaBlock, AnswerResult } from '@english-saas/api-client';
import { useSubmitAnswer } from '@english-saas/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  ItemRenderer,
  toItemView,
} from '@english-saas/ui';
import type { ItemAnswerPayload } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';

export type PracticeBlockModalProps = {
  block: AgendaBlock | null;
  onClose: () => void;
  onFinished: () => void;
};

export function PracticeBlockModal({
  block,
  onClose,
  onFinished,
}: PracticeBlockModalProps) {
  if (block === null || block.item === undefined) {
    return null;
  }

  return (
    <PracticeBlockModalContent
      key={block.id}
      item={block.item}
      onClose={onClose}
      onFinished={onFinished}
    />
  );
}

function PracticeBlockModalContent({
  item,
  onClose,
  onFinished,
}: {
  item: NonNullable<AgendaBlock['item']>;
  onClose: () => void;
  onFinished: () => void;
}) {
  const submitAnswer = useSubmitAnswer();
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [clientAnswerId] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => Date.now());

  function handleAnswer(payload: ItemAnswerPayload): void {
    submitAnswer.mutate(
      {
        itemId: item.id,
        context: 'TARGETED_PRACTICE',
        response: payload.response,
        responseTimeMs: Date.now() - startedAt,
        hintsUsed: payload.hintsUsed,
        clientAnswerId,
      },
      { onSuccess: (result) => setFeedback(result) },
    );
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {t('today.practiceModal.title')}
        </DialogTitle>

        <div className="mt-4">
          <ItemRenderer
            item={toItemView(item, item.assets)}
            mode="practice"
            feedback={feedback}
            disabled={feedback !== null}
            onAnswer={handleAnswer}
          />
        </div>

        {feedback !== null ? (
          <Button onClick={onFinished} className="mt-4 self-end">
            {t('today.practiceModal.continue')}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
