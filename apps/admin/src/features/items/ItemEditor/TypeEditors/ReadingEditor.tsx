import type { Span } from '@english-saas/shared';
import { Textarea } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { MarkedTextField } from '../../../curriculum/components/MarkedTextField';
import { issuesAt } from '../../../curriculum/lib/validation';
import { ChoiceEditor } from './ChoiceEditor';
import type { TypeEditorProps } from './types';

const MAX_PASSAGE = 4_000;

/**
 * Texto com marcações (o mesmo editor das cenas) e a pergunta de escolha
 * sobre ele. A tradução do texto só o editor vê: não vai para o aluno.
 */
export function ReadingEditor(props: TypeEditorProps) {
  const { content, onChange, issues, readOnly } = props;
  const passage = (content.passage as string | undefined) ?? '';
  const spans = (content.spans as Span[] | undefined) ?? [];
  const translation = (content.passageTranslation as string | undefined) ?? '';

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-label={t('items.reading.title')}>
        <h3 className="font-display text-lg text-ink">
          {t('items.reading.title')}
        </h3>
        <MarkedTextField
          label={t('items.reading.passage')}
          text={passage}
          spans={spans}
          onChange={(next) =>
            onChange({ ...content, passage: next.text, spans: next.spans })
          }
          textPath="content.passage"
          spansPath="content.spans"
          issues={[...issues]}
          readOnly={readOnly}
          maxLength={MAX_PASSAGE}
        />
        <Textarea
          label={t('items.reading.translation')}
          hint={t('items.reading.translationHint')}
          value={translation}
          readOnly={readOnly}
          rows={3}
          onChange={(event) =>
            onChange({ ...content, passageTranslation: event.target.value })
          }
          error={issuesAt(issues, 'content.passageTranslation')[0]}
        />
      </section>

      <ChoiceEditor {...props} />
    </div>
  );
}
