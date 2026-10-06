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

const MAX_CHOICES = 6;

/** Frase com a lacuna `___`, dica e, se quiser, alternativas para escolher. */
export function FillBlankEditor({
  content,
  onChange,
  issues,
  readOnly,
}: TypeEditorProps) {
  const sentence = (content.sentence as string | undefined) ?? '';
  const hint = (content.hint as string | undefined) ?? '';
  const choices = (content.choices as string[] | undefined) ?? [];

  function update(patch: Record<string, unknown>): void {
    onChange({ ...content, ...patch });
  }

  return (
    <section className="space-y-4" aria-label={t('items.fill.title')}>
      <h3 className="font-display text-lg text-ink">{t('items.fill.title')}</h3>
      <Input
        label={t('items.fill.sentence')}
        hint={t('items.fill.sentenceHint')}
        value={sentence}
        readOnly={readOnly}
        onChange={(event) => update({ sentence: event.target.value })}
        error={issuesAt(issues, 'content.sentence')[0]}
        data-field="content.sentence"
      />
      <Input
        label={t('items.fill.hint')}
        value={hint}
        readOnly={readOnly}
        onChange={(event) => update({ hint: event.target.value })}
        error={issuesAt(issues, 'content.hint')[0]}
      />

      <div className="space-y-3" data-field="content.choices">
        <h4 className="text-sm font-medium text-ink">
          {t('items.fill.choices')}
        </h4>
        <p className="text-xs text-muted">{t('items.fill.choicesHint')}</p>
        {issuesAt(issues, 'content.choices').map((message) => (
          <p key={message} className="text-sm text-error">
            {message}
          </p>
        ))}
        <ol className="space-y-2">
          {choices.map((choice, index) => (
            <ListItemCard
              key={index}
              title={t('items.fill.choice', { position: index + 1 })}
              label={t('items.fill.choiceLabel', { position: index + 1 })}
              index={index}
              count={choices.length}
              readOnly={readOnly}
              onMove={(delta) =>
                update({ choices: moveItem(choices, index, delta) })
              }
              onRemove={() => update({ choices: removeAt(choices, index) })}
            >
              <Input
                aria-label={t('items.fill.choiceLabel', {
                  position: index + 1,
                })}
                value={choice}
                readOnly={readOnly}
                onChange={(event) =>
                  update({
                    choices: replaceAt(choices, index, event.target.value),
                  })
                }
                error={issuesAt(issues, path('content', 'choices', index))[0]}
                data-field={path('content', 'choices', index)}
              />
            </ListItemCard>
          ))}
        </ol>
        {readOnly ? null : (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            disabled={choices.length >= MAX_CHOICES}
            onClick={() => update({ choices: [...choices, ''] })}
          >
            {t('items.fill.addChoice')}
          </Button>
        )}
      </div>
    </section>
  );
}
