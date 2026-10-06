import { Input } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { issuesAt } from '../../../curriculum/lib/validation';
import type { TypeEditorProps } from './types';

/** O aluno escreve a resposta. O texto de origem e a dica são opcionais. */
export function TypeAnswerEditor({
  content,
  onChange,
  issues,
  readOnly,
}: TypeEditorProps) {
  const sourceText = (content.sourceText as string | undefined) ?? '';
  const hint = (content.hint as string | undefined) ?? '';

  return (
    <section className="space-y-4" aria-label={t('items.type.title')}>
      <h3 className="font-display text-lg text-ink">{t('items.type.title')}</h3>
      <Input
        label={t('items.type.source')}
        hint={t('items.type.sourceHint')}
        value={sourceText}
        readOnly={readOnly}
        onChange={(event) =>
          onChange({ ...content, sourceText: event.target.value })
        }
        error={issuesAt(issues, 'content.sourceText')[0]}
        data-field="content.sourceText"
      />
      <Input
        label={t('items.type.hint')}
        value={hint}
        readOnly={readOnly}
        onChange={(event) => onChange({ ...content, hint: event.target.value })}
        error={issuesAt(issues, 'content.hint')[0]}
        data-field="content.hint"
      />
    </section>
  );
}
