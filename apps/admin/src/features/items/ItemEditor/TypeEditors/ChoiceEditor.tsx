import { Button, Checkbox, Input } from '@english-saas/ui';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { t } from '../../../../messages/pt-BR';
import { ListItemCard } from '../../../curriculum/components/ListItemCard';
import {
  moveItem,
  removeAt,
  replaceAt,
} from '../../../curriculum/lib/list-ops';
import { issuesAt, path } from '../../../curriculum/lib/validation';
import { OPTION_IDS, nextOptionId } from '../../lib/item-form';
import type { ChoiceContent, Option, TypeEditorProps } from './types';

const MIN_OPTIONS = 2;

/**
 * Alternativas e gabarito — o miolo de MULTIPLE_CHOICE, LISTEN_CHOOSE e
 * READING_COMPREHENSION. O id de cada alternativa (`a`, `b`…) é interno: o
 * editor vê "Alternativa 1", e mover a alternativa não muda o id, então o
 * gabarito continua apontando para a certa.
 */
export function ChoiceEditor({
  content,
  onChange,
  issues,
  readOnly,
  children,
}: TypeEditorProps & { children?: ReactNode }) {
  const choice = content as unknown as ChoiceContent;
  const options = choice.options ?? [];
  const correct = choice.correctOptionIds ?? [];

  function update(patch: Partial<ChoiceContent>): void {
    onChange({ ...content, ...patch });
  }

  function updateOption(index: number, option: Option): void {
    update({ options: replaceAt(options, index, option) });
  }

  function toggleCorrect(id: string, on: boolean): void {
    update({
      correctOptionIds: on
        ? [...correct, id]
        : correct.filter((entry) => entry !== id),
    });
  }

  function removeOption(index: number): void {
    const removed = options[index];

    update({
      options: removeAt(options, index),
      correctOptionIds: correct.filter((id) => id !== removed?.id),
    });
  }

  return (
    <div className="space-y-4">
      {children}

      <section
        className="space-y-3"
        data-field="content.options"
        aria-label={t('items.choice.title')}
      >
        <h3 className="font-display text-lg text-ink">
          {t('items.choice.title')}
        </h3>
        <p className="text-xs text-muted">{t('items.choice.hint')}</p>
        {issuesAt(issues, 'content.options').map((message) => (
          <p key={message} className="text-sm text-error">
            {message}
          </p>
        ))}
        {issuesAt(issues, 'content.correctOptionIds').map((message) => (
          <p
            key={message}
            data-field="content.correctOptionIds"
            className="text-sm text-error"
          >
            {message}
          </p>
        ))}

        <ol className="space-y-2">
          {options.map((option, index) => (
            <ListItemCard
              key={option.id}
              title={t('items.choice.option', { position: index + 1 })}
              label={t('items.choice.optionLabel', { position: index + 1 })}
              index={index}
              count={options.length}
              readOnly={readOnly}
              onMove={(delta) =>
                update({ options: moveItem(options, index, delta) })
              }
              onRemove={
                options.length > MIN_OPTIONS
                  ? () => removeOption(index)
                  : undefined
              }
              fieldPath={path('content', 'options', index)}
            >
              <Input
                label={t('items.choice.text')}
                value={option.text}
                readOnly={readOnly}
                onChange={(event) =>
                  updateOption(index, { ...option, text: event.target.value })
                }
                error={
                  issuesAt(issues, path('content', 'options', index, 'text'))[0]
                }
                data-field={path('content', 'options', index, 'text')}
              />
              <Input
                label={t('items.choice.translation')}
                value={option.translation ?? ''}
                readOnly={readOnly}
                onChange={(event) =>
                  updateOption(index, {
                    ...option,
                    translation: event.target.value,
                  })
                }
                error={
                  issuesAt(
                    issues,
                    path('content', 'options', index, 'translation'),
                  )[0]
                }
              />
              <Checkbox
                label={t('items.choice.correct')}
                checked={correct.includes(option.id)}
                disabled={readOnly}
                onCheckedChange={(checked) => toggleCorrect(option.id, checked)}
              />
            </ListItemCard>
          ))}
        </ol>

        {readOnly ? null : (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            disabled={options.length >= OPTION_IDS.length}
            onClick={() =>
              update({
                options: [...options, { id: nextOptionId(options), text: '' }],
              })
            }
          >
            {t('items.choice.add')}
          </Button>
        )}

        <Checkbox
          label={t('items.choice.shuffle')}
          checked={choice.shuffle ?? true}
          disabled={readOnly}
          onCheckedChange={(checked) => update({ shuffle: checked })}
        />
      </section>
    </div>
  );
}
