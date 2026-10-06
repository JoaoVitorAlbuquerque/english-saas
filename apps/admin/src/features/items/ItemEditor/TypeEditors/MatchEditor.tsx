import { Button, Input } from '@english-saas/ui';
import { Plus } from 'lucide-react';

import { t } from '../../../../messages/pt-BR';
import { ListItemCard } from '../../../curriculum/components/ListItemCard';
import {
  moveItem,
  removeAt,
  replaceAt,
} from '../../../curriculum/lib/list-ops';
import { issuesAt, path } from '../../../curriculum/lib/validation';
import type { TypeEditorProps } from './types';

type Pair = { left: string; right: string };

const MIN_PAIRS = 2;
const MAX_PAIRS = 8;

/** Pares de ligar: o lado esquerdo não se repete. */
export function MatchEditor({
  content,
  onChange,
  issues,
  readOnly,
}: TypeEditorProps) {
  const pairs = (content.pairs as Pair[] | undefined) ?? [];

  function update(next: Pair[]): void {
    onChange({ ...content, pairs: next });
  }

  return (
    <section
      className="space-y-3"
      data-field="content.pairs"
      aria-label={t('items.match.title')}
    >
      <h3 className="font-display text-lg text-ink">
        {t('items.match.title')}
      </h3>
      <p className="text-xs text-muted">{t('items.match.hint')}</p>
      {issuesAt(issues, 'content.pairs').map((message) => (
        <p key={message} className="text-sm text-error">
          {message}
        </p>
      ))}

      <ol className="space-y-2">
        {pairs.map((pair, index) => (
          <ListItemCard
            key={index}
            title={t('items.match.pair', { position: index + 1 })}
            label={t('items.match.pairLabel', { position: index + 1 })}
            index={index}
            count={pairs.length}
            readOnly={readOnly}
            onMove={(delta) => update(moveItem(pairs, index, delta))}
            onRemove={
              pairs.length > MIN_PAIRS
                ? () => update(removeAt(pairs, index))
                : undefined
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t('items.match.left')}
                value={pair.left}
                readOnly={readOnly}
                onChange={(event) =>
                  update(
                    replaceAt(pairs, index, {
                      ...pair,
                      left: event.target.value,
                    }),
                  )
                }
                error={
                  issuesAt(issues, path('content', 'pairs', index, 'left'))[0]
                }
                data-field={path('content', 'pairs', index, 'left')}
              />
              <Input
                label={t('items.match.right')}
                value={pair.right}
                readOnly={readOnly}
                onChange={(event) =>
                  update(
                    replaceAt(pairs, index, {
                      ...pair,
                      right: event.target.value,
                    }),
                  )
                }
                error={
                  issuesAt(issues, path('content', 'pairs', index, 'right'))[0]
                }
                data-field={path('content', 'pairs', index, 'right')}
              />
            </div>
          </ListItemCard>
        ))}
      </ol>

      {readOnly ? null : (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          disabled={pairs.length >= MAX_PAIRS}
          onClick={() => update([...pairs, { left: '', right: '' }])}
        >
          {t('items.match.add')}
        </Button>
      )}
    </section>
  );
}
