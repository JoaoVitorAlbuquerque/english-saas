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

const MIN_TOKENS = 2;
const MAX_TOKENS = 20;

/** As peças que o aluno embaralha. A frase certa vai em "respostas aceitas". */
export function OrderWordsEditor({
  content,
  onChange,
  issues,
  readOnly,
}: TypeEditorProps) {
  const tokens = (content.tokens as string[] | undefined) ?? [];

  function update(next: string[]): void {
    onChange({ ...content, tokens: next });
  }

  return (
    <section
      className="space-y-3"
      data-field="content.tokens"
      aria-label={t('items.order.title')}
    >
      <h3 className="font-display text-lg text-ink">
        {t('items.order.title')}
      </h3>
      <p className="text-xs text-muted">{t('items.order.hint')}</p>
      {issuesAt(issues, 'content.tokens').map((message) => (
        <p key={message} className="text-sm text-error">
          {message}
        </p>
      ))}

      <ol className="space-y-2">
        {tokens.map((token, index) => (
          <ListItemCard
            key={index}
            title={t('items.order.token', { position: index + 1 })}
            label={t('items.order.tokenLabel', { position: index + 1 })}
            index={index}
            count={tokens.length}
            readOnly={readOnly}
            onMove={(delta) => update(moveItem(tokens, index, delta))}
            onRemove={
              tokens.length > MIN_TOKENS
                ? () => update(removeAt(tokens, index))
                : undefined
            }
          >
            <Input
              aria-label={t('items.order.tokenLabel', { position: index + 1 })}
              value={token}
              readOnly={readOnly}
              onChange={(event) =>
                update(replaceAt(tokens, index, event.target.value))
              }
              error={issuesAt(issues, path('content', 'tokens', index))[0]}
              data-field={path('content', 'tokens', index)}
            />
          </ListItemCard>
        ))}
      </ol>

      {readOnly ? null : (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          disabled={tokens.length >= MAX_TOKENS}
          onClick={() => update([...tokens, ''])}
        >
          {t('items.order.add')}
        </Button>
      )}
    </section>
  );
}
