import type {
  AnswerResult,
  LessonItem,
  ResolvedAsset,
} from '@english-saas/api-client';
import { Button, ItemRenderer, toItemView } from '@english-saas/ui';
import type { ItemAnswerPayload } from '@english-saas/ui';
import type { PracticeContent } from '@english-saas/shared';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';

export type PracticeStepProps = {
  content: PracticeContent;
  items: LessonItem[];
  assets: Record<string, ResolvedAsset>;
  answeredItemIds: string[];
  answers: Record<string, AnswerResult>;
  onAnswer: (itemId: string, payload: ItemAnswerPayload) => void;
  onContinue: () => void;
};

function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

export function PracticeStep({
  content,
  items,
  assets,
  answeredItemIds,
  answers,
  onAnswer,
  onContinue,
}: PracticeStepProps) {
  const [order] = useState(() =>
    content.shuffle ? shuffled(content.itemIds) : content.itemIds,
  );
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const answeredIds = new Set([...answeredItemIds, ...Object.keys(answers)]);
  const firstUnanswered = (): string | null =>
    order.find((id) => !answeredIds.has(id)) ?? null;
  // O item na tela só muda no "Continuar": responder marca como respondido,
  // mas o feedback precisa ficar visível até o aluno seguir.
  const [currentId, setCurrentId] = useState<string | null>(firstUnanswered);
  const answeredCount = order.filter((id) => answeredIds.has(id)).length;
  const currentItem = currentId ? itemsById.get(currentId) : undefined;
  const currentFeedback = currentId ? (answers[currentId] ?? null) : null;

  function handleContinue(): void {
    const next = firstUnanswered();
    if (next === null) {
      onContinue();
      return;
    }
    setCurrentId(next);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <p className="text-sm text-muted">
        Questão{' '}
        {Math.min(
          currentFeedback === null ? answeredCount + 1 : answeredCount,
          order.length,
        )}{' '}
        de {order.length}
      </p>

      {currentItem ? (
        <ItemRenderer
          key={currentItem.id}
          item={toItemView(currentItem, assets)}
          mode="practice"
          feedback={currentFeedback}
          disabled={currentFeedback !== null}
          onAnswer={(payload) => onAnswer(currentItem.id, payload)}
        />
      ) : null}

      {currentFeedback !== null || currentItem === undefined ? (
        <Button onClick={handleContinue} className="self-end">
          {t('lesson.common.continue')}
        </Button>
      ) : null}
    </div>
  );
}
