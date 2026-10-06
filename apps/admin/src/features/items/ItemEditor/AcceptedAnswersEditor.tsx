import { Button, Input } from '@english-saas/ui';
import { Plus } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { ListItemCard } from '../../curriculum/components/ListItemCard';
import { moveItem, removeAt, replaceAt } from '../../curriculum/lib/list-ops';
import {
  issuesAt,
  path,
  type FieldIssue,
} from '../../curriculum/lib/validation';

const MAX_ANSWERS = 20;

/**
 * As respostas certas dos tipos digitados. A primeira é a "de referência":
 * é a que o aluno vê no gabarito. As outras são variações aceitas — o
 * servidor já trata maiúscula, pontuação e contração ("she's" = "she is"),
 * então só entram aqui variações de verdade.
 */
export function AcceptedAnswersEditor({
  answers,
  onChange,
  issues,
  readOnly,
}: {
  answers: readonly string[];
  onChange: (answers: string[]) => void;
  issues: readonly FieldIssue[];
  readOnly: boolean;
}) {
  return (
    <section
      className="space-y-3"
      data-field="acceptedAnswers"
      aria-label={t('items.accepted.title')}
    >
      <h3 className="font-display text-lg text-ink">
        {t('items.accepted.title')}
      </h3>
      <p className="text-xs text-muted">{t('items.accepted.hint')}</p>
      {issuesAt(issues, 'acceptedAnswers').map((message) => (
        <p key={message} className="text-sm text-error">
          {message}
        </p>
      ))}

      <ol className="space-y-2">
        {answers.map((answer, index) => (
          <ListItemCard
            key={index}
            title={
              index === 0
                ? t('items.accepted.reference')
                : t('items.accepted.variation', { position: index })
            }
            label={t('items.accepted.label', { position: index + 1 })}
            index={index}
            count={answers.length}
            readOnly={readOnly}
            onMove={(delta) => onChange(moveItem(answers, index, delta))}
            onRemove={
              answers.length > 1
                ? () => onChange(removeAt(answers, index))
                : undefined
            }
          >
            <Input
              aria-label={t('items.accepted.label', { position: index + 1 })}
              value={answer}
              readOnly={readOnly}
              onChange={(event) =>
                onChange(replaceAt(answers, index, event.target.value))
              }
              error={issuesAt(issues, path('acceptedAnswers', index))[0]}
              data-field={path('acceptedAnswers', index)}
            />
          </ListItemCard>
        ))}
      </ol>

      {readOnly ? null : (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          disabled={answers.length >= MAX_ANSWERS}
          onClick={() => onChange([...answers, ''])}
        >
          {t('items.accepted.add')}
        </Button>
      )}
    </section>
  );
}
