import type { PracticeContent } from '@english-saas/shared';
import { useState } from 'react';

import { Button } from '../components/Button/Button';
import { ItemRenderer } from '../items/ItemRenderer';
import { toItemView, type RawStudentItem } from '../items/to-item-view';
import type { ItemAnswerPayload, ItemFeedback } from '../items/types';
import type { LessonAssets } from './lesson-types';

export type PracticeViewProps = {
  content: PracticeContent;
  items: readonly RawStudentItem[];
  assets: LessonAssets;
  answeredItemIds: readonly string[];
  /** Resposta corrigida de cada item, por id. */
  answers: Record<string, ItemFeedback>;
  onAnswer: (itemId: string, payload: ItemAnswerPayload) => void;
  /** Resposta a caminho — trava a questão contra um segundo clique. */
  isSubmitting: boolean;
  onContinue: () => void;
};

function shuffled<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Etapa de prática: uma questão por vez, feedback antes de seguir. */
export function PracticeView({
  content,
  items,
  assets,
  answeredItemIds,
  answers,
  onAnswer,
  isSubmitting,
  onContinue,
}: PracticeViewProps) {
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
          disabled={currentFeedback !== null || isSubmitting}
          onAnswer={(payload) => onAnswer(currentItem.id, payload)}
        />
      ) : null}

      {currentFeedback !== null || currentItem === undefined ? (
        <Button onClick={handleContinue} className="self-end">
          Continuar
        </Button>
      ) : null}
    </div>
  );
}
