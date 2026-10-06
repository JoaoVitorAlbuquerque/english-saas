import { Button } from '@english-saas/ui';

import { t, type MessageKey } from '../../../../messages/pt-BR';
import type { ItemProblem } from '../../lib/item-editorial';

const REFERENCE_LABELS: Record<string, MessageKey> = {
  skills: 'editorial.problem.reference.skills',
  registerNotes: 'editorial.problem.reference.registerNotes',
  errorPatterns: 'editorial.problem.reference.errorPatterns',
  assets: 'editorial.problem.reference.assets',
};

const FIELD_LABELS: Record<string, MessageKey> = {
  type: 'items.field.type',
  prompt: 'items.field.prompt',
  content: 'items.field.content',
  acceptedAnswers: 'items.field.acceptedAnswers',
};

export type ItemProblemPanelProps = {
  problem: ItemProblem;
  /** Leva ao campo com erro (caminho `content.options.0.text`…). */
  onJumpToIssue?: (path: string) => void;
  onDismiss: () => void;
};

/** O que a API recusou ao salvar ou mover o item, em português e por tipo. */
export function ItemProblemPanel({
  problem,
  onJumpToIssue,
  onDismiss,
}: ItemProblemPanelProps) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-xl border border-error bg-error/10 p-4 text-sm text-ink"
    >
      <p className="font-medium">{t('items.problem.title')}</p>

      {problem.kind === 'validation' ? (
        <>
          <p>{t('items.problem.validation')}</p>
          <ul className="space-y-1">
            {problem.issues.map((issue, index) => (
              <li
                key={`${issue.path}-${String(index)}`}
                className="flex flex-wrap items-baseline gap-x-2"
              >
                <span>{issue.message}</span>
                {onJumpToIssue && issue.path !== '' ? (
                  <button
                    type="button"
                    className="text-accent underline"
                    onClick={() => onJumpToIssue(issue.path)}
                  >
                    {t('items.problem.goToField')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {problem.kind === 'references' ? (
        <>
          <p>{problem.reason ?? problem.message}</p>
          <ul className="space-y-1">
            {Object.entries(problem.missing).map(([key, list]) => (
              <li key={key}>
                <span className="text-muted">
                  {REFERENCE_LABELS[key] ? t(REFERENCE_LABELS[key]) : key}:
                </span>{' '}
                <span className="font-mono">{list.join(', ')}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {problem.kind === 'immutable' ? (
        <>
          <p>{problem.message}</p>
          <p className="text-muted">
            {t('items.problem.immutableFields', {
              fields: problem.fields
                .map((field) =>
                  FIELD_LABELS[field] ? t(FIELD_LABELS[field]) : field,
                )
                .join(', '),
            })}
          </p>
        </>
      ) : null}

      {problem.kind === 'in-use' ? (
        <>
          <p>{problem.message}</p>
          <p className="text-muted">{t('items.problem.inUse')}</p>
          <ul className="list-disc pl-5">
            {problem.lessons.map((slug) => (
              <li key={slug} className="font-mono">
                {slug}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {problem.kind === 'transition' || problem.kind === 'other' ? (
        <p>{problem.message}</p>
      ) : null}

      <Button size="sm" variant="ghost" onClick={onDismiss}>
        {t('editorial.problem.dismiss')}
      </Button>
    </div>
  );
}
