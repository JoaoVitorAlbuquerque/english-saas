import type { Draft } from '@english-saas/api-client';
import { ITEM_TYPE_LABELS, type ItemType } from '@english-saas/shared';

import { t } from '../../../messages/pt-BR';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** O pedido de um rascunho em uma linha, para a fila. */
export function summarizeDraft(draft: Draft): string {
  const params = draft.params;

  if (draft.kind === 'LESSON') {
    const objective = text(params['objective']);

    return t('studio.queue.summary.lesson', {
      level: text(params['level']),
      objective:
        objective === '' ? t('studio.queue.summary.noObjective') : objective,
    });
  }

  if (draft.kind === 'ITEMS') {
    const types = Array.isArray(params['types'])
      ? params['types']
          .map((type) => ITEM_TYPE_LABELS[type as ItemType] ?? String(type))
          .join(', ')
      : '';

    return t('studio.queue.summary.items', {
      count: Number(params['count'] ?? 0),
      skill: text(params['skillId']),
      level: text(params['level']),
      types,
    });
  }

  return t('studio.queue.summary.notes', {
    count: Number(params['count'] ?? 0),
    level: text(params['level']),
  });
}
