import { Input } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { issuesAt } from '../../../curriculum/lib/validation';
import { AudioTextField } from './AudioTextField';
import type { TypeEditorProps } from './types';

/** O aluno ouve e escreve. `maxPlays = 0` deixa tocar quantas vezes quiser. */
export function DictationEditor(props: TypeEditorProps) {
  const { content, onChange, issues, readOnly } = props;
  const maxPlays = content.maxPlays as number | undefined;

  return (
    <AudioTextField {...props}>
      <Input
        type="number"
        min={0}
        max={10}
        label={t('items.dictation.maxPlays')}
        hint={t('items.dictation.maxPlaysHint')}
        value={maxPlays === undefined ? '' : String(maxPlays)}
        readOnly={readOnly}
        onChange={(event) =>
          onChange({
            ...content,
            maxPlays:
              event.target.value === '' ? 0 : Number(event.target.value),
          })
        }
        error={issuesAt(issues, 'content.maxPlays')[0]}
        data-field="content.maxPlays"
      />
    </AudioTextField>
  );
}
