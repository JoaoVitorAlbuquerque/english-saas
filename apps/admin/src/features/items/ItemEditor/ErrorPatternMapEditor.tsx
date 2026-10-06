import { Button, Input, Select } from '@english-saas/ui';
import { Plus, Trash2 } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { ErrorPatternSelect } from '../../curriculum/components/ReferenceSelects';
import {
  issuesAt,
  path,
  type FieldIssue,
} from '../../curriculum/lib/validation';
import type { ItemFormState } from '../lib/item-form';

const CHOICE_TYPES = [
  'MULTIPLE_CHOICE',
  'LISTEN_CHOOSE',
  'READING_COMPREHENSION',
] as const;

type Row = ItemFormState['errorPatternMap'][number];

/** As alternativas **erradas**, pelo texto: é a chave do mapa nos itens de escolha. */
function wrongOptionTexts(state: ItemFormState): string[] {
  const options =
    (state.content.options as { id: string; text: string }[] | undefined) ?? [];
  const correct =
    (state.content.correctOptionIds as string[] | undefined) ?? [];

  return options
    .filter(
      (option) => !correct.includes(option.id) && option.text.trim() !== '',
    )
    .map((option) => option.text.trim());
}

/**
 * "Se o aluno responder isto, é este erro típico." O servidor usa o mapa
 * para dizer, depois da resposta, qual erro de brasileiro apareceu e
 * alimentar o modelo do aluno.
 *
 * - Escolha: a chave é o **texto** de uma alternativa errada.
 * - Digitados: a chave é uma resposta errada típica, escrita à mão.
 * - Ligar pares: não se aplica (o servidor não olha o mapa).
 */
export function ErrorPatternMapEditor({
  state,
  onAdd,
  onChange,
  onRemove,
  issues,
  readOnly,
}: {
  state: ItemFormState;
  onAdd: () => void;
  onChange: (key: string, patch: Partial<Omit<Row, 'key'>>) => void;
  onRemove: (key: string) => void;
  issues: readonly FieldIssue[];
  readOnly: boolean;
}) {
  const isChoice = (CHOICE_TYPES as readonly string[]).includes(state.type);
  const rows = state.errorPatternMap;

  if (state.type === 'MATCH') {
    return (
      <section className="space-y-2" aria-label={t('items.map.title')}>
        <h3 className="font-display text-lg text-ink">
          {t('items.map.title')}
        </h3>
        <p className="text-sm text-muted">{t('items.map.notForMatch')}</p>
      </section>
    );
  }

  const wrongTexts = isChoice ? wrongOptionTexts(state) : [];

  return (
    <section
      className="space-y-3"
      data-field="errorPatternMap"
      aria-label={t('items.map.title')}
    >
      <h3 className="font-display text-lg text-ink">{t('items.map.title')}</h3>
      <p className="text-xs text-muted">
        {isChoice ? t('items.map.hintChoice') : t('items.map.hintTyped')}
      </p>
      {issuesAt(issues, 'errorPatternMap').map((message) => (
        <p key={message} className="text-sm text-error">
          {message}
        </p>
      ))}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('items.map.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              data-field={path('errorPatternMap', index)}
              className="grid items-start gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              {isChoice ? (
                <Select
                  label={t('items.map.wrongOption')}
                  value={row.wrong}
                  disabled={readOnly}
                  onChange={(event) =>
                    onChange(row.key, { wrong: event.target.value })
                  }
                  options={[
                    { value: '', label: t('items.map.chooseOption') },
                    ...[...new Set([...wrongTexts, row.wrong])]
                      .filter((text) => text !== '')
                      .map((text) => ({ value: text, label: text })),
                  ]}
                  error={issuesAt(issues, path('errorPatternMap', index))[0]}
                />
              ) : (
                <Input
                  label={t('items.map.wrongAnswer')}
                  value={row.wrong}
                  readOnly={readOnly}
                  onChange={(event) =>
                    onChange(row.key, { wrong: event.target.value })
                  }
                  error={issuesAt(issues, path('errorPatternMap', index))[0]}
                />
              )}
              <ErrorPatternSelect
                label={t('items.map.pattern')}
                value={row.patternId}
                disabled={readOnly}
                onChange={(value) => onChange(row.key, { patternId: value })}
              />
              {readOnly ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="sm:mt-7"
                  aria-label={t('items.map.remove', { position: index + 1 })}
                  onClick={() => onRemove(row.key)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {readOnly ? null : (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          onClick={onAdd}
        >
          {t('items.map.add')}
        </Button>
      )}
    </section>
  );
}
