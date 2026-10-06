import {
  REGISTER_SWAP_DIRECTIONS,
  type RegisterSwapDirection,
} from '@english-saas/shared';
import { Input, Select } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { RegisterNoteSelect } from '../../../curriculum/components/ReferenceSelects';
import { issuesAt } from '../../../curriculum/lib/validation';
import type { TypeEditorProps } from './types';

const DIRECTION_LABELS: Record<RegisterSwapDirection, string> = {
  SPOKEN_TO_STANDARD: 'Da fala para a estrutura padrão',
  STANDARD_TO_SPOKEN: 'Da estrutura padrão para a fala',
};

/** Passar uma frase da forma falada para a padrão, ou o contrário. */
export function RegisterSwapEditor({
  content,
  onChange,
  issues,
  readOnly,
}: TypeEditorProps) {
  const source = (content.source as string | undefined) ?? '';
  const direction =
    (content.direction as RegisterSwapDirection | undefined) ??
    'SPOKEN_TO_STANDARD';
  const noteId = (content.registerNoteId as string | undefined) ?? '';

  return (
    <section className="space-y-4" aria-label={t('items.swap.title')}>
      <h3 className="font-display text-lg text-ink">{t('items.swap.title')}</h3>
      <Input
        label={t('items.swap.source')}
        hint={t('items.swap.sourceHint')}
        value={source}
        readOnly={readOnly}
        onChange={(event) =>
          onChange({ ...content, source: event.target.value })
        }
        error={issuesAt(issues, 'content.source')[0]}
        data-field="content.source"
      />
      <Select
        label={t('items.swap.direction')}
        value={direction}
        disabled={readOnly}
        onChange={(event) =>
          onChange({ ...content, direction: event.target.value })
        }
        options={REGISTER_SWAP_DIRECTIONS.map((entry) => ({
          value: entry,
          label: DIRECTION_LABELS[entry],
        }))}
        error={issuesAt(issues, 'content.direction')[0]}
        data-field="content.direction"
      />
      <RegisterNoteSelect
        label={t('items.swap.note')}
        value={noteId}
        disabled={readOnly}
        onChange={(value) => onChange({ ...content, registerNoteId: value })}
        error={issuesAt(issues, 'content.registerNoteId')[0]}
        fieldPath="content.registerNoteId"
      />
    </section>
  );
}
