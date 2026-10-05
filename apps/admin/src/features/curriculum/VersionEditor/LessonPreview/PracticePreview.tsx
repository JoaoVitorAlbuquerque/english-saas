import { useAdminItem } from '@english-saas/api-client';
import {
  Button,
  ItemRenderer,
  toItemView,
  type LessonAssets,
  type RawStudentItem,
} from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../../messages/pt-BR';
import { buildPreviewFeedback } from '../../lib/preview-feedback';

export type PracticePreviewProps = {
  itemIds: readonly string[];
  /** As questões como o aluno recebe: sem gabarito. */
  items: readonly RawStudentItem[];
  assets: LessonAssets;
  onContinue: () => void;
};

function AnswerKeyItem({
  item,
  assets,
}: {
  item: RawStudentItem;
  assets: LessonAssets;
}) {
  // O gabarito só o editor lê: vem de `GET items/:id`, não do preview.
  const full = useAdminItem(item.id);

  return (
    <ItemRenderer
      key={`${item.id}-key`}
      item={toItemView(item, assets)}
      mode="preview"
      feedback={full.data ? buildPreviewFeedback(full.data) : null}
    />
  );
}

/**
 * A prática no preview: a questão aparece como para o aluno e dá para
 * responder, mas a resposta **não é corrigida** (nada é enviado). "Ver
 * gabarito" troca para o modo `preview` dos componentes de questão, com a
 * resposta certa e a explicação.
 */
export function PracticePreview({
  itemIds,
  items,
  assets,
  onContinue,
}: PracticePreviewProps) {
  const [index, setIndex] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const total = itemIds.length;
  const itemId = itemIds[index];
  const item = items.find((candidate) => candidate.id === itemId);

  function go(next: number): void {
    setIndex(next);
    setShowKey(false);
  }

  if (total === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-sm text-muted">
        {t('preview.practice.empty')}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <p className="text-sm text-muted">
        {t('preview.practice.position', { position: index + 1, total })}
      </p>

      {item === undefined ? (
        <p className="text-sm text-muted">{t('preview.practice.missing')}</p>
      ) : showKey ? (
        <AnswerKeyItem item={item} assets={assets} />
      ) : (
        <ItemRenderer
          key={item.id}
          item={toItemView(item, assets)}
          mode="practice"
          onAnswer={() => undefined}
        />
      )}

      <p className="rounded-lg bg-ground px-3 py-2 text-xs text-muted">
        {t('preview.practice.note')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={item === undefined}
          onClick={() => setShowKey((current) => !current)}
        >
          {showKey
            ? t('preview.practice.hideKey')
            : t('preview.practice.answerKey')}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            {t('preview.practice.prev')}
          </Button>
          {index < total - 1 ? (
            <Button size="sm" onClick={() => go(index + 1)}>
              {t('preview.practice.next')}
            </Button>
          ) : (
            <Button size="sm" onClick={onContinue}>
              {t('preview.continue')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
