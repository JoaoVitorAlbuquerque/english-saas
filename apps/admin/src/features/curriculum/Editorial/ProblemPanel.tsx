import {
  LESSON_STEP_TYPE_LABELS,
  type LessonStepType,
} from '@english-saas/shared';
import { Button } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t, type MessageKey } from '../../../messages/pt-BR';
import type { EditorialProblem } from '../lib/editorial';
import { describePath } from '../lib/validation';

export type ProblemPanelProps = {
  problem: EditorialProblem;
  /** Tipo de cada etapa, pela posição — dá nome às etapas da lista. */
  stepTypes?: readonly LessonStepType[];
  /** No editor, leva ao campo com erro. */
  onJumpToIssue?: (order: number, path: string) => void;
  /** Fora do editor (lista de versões), o link para abrir a versão. */
  editorHref?: string;
  onDismiss: () => void;
};

const REFERENCE_LABELS: Record<string, MessageKey> = {
  skills: 'editorial.problem.reference.skills',
  registerNotes: 'editorial.problem.reference.registerNotes',
  errorPatterns: 'editorial.problem.reference.errorPatterns',
  characters: 'editorial.problem.reference.characters',
  assets: 'editorial.problem.reference.assets',
  items: 'editorial.problem.reference.items',
};

function ValidationList({
  problem,
  stepTypes,
  onJumpToIssue,
  editorHref,
}: Pick<ProblemPanelProps, 'stepTypes' | 'onJumpToIssue' | 'editorHref'> & {
  problem: Extract<EditorialProblem, { kind: 'validation' }>;
}) {
  const orders = [...new Set(problem.issues.map((issue) => issue.order))].sort(
    (a, b) => a - b,
  );

  return (
    <>
      <p>{t('editorial.problem.validation')}</p>
      <ul className="mt-2 space-y-3">
        {orders.map((order) => {
          const type = order >= 0 ? stepTypes?.[order] : undefined;

          return (
            <li key={order}>
              <p className="font-medium">
                {order < 0
                  ? t('editorial.problem.lessonLevel')
                  : t('editorial.problem.validationStep', {
                      position: order + 1,
                      type: type ? LESSON_STEP_TYPE_LABELS[type] : '',
                    })}
              </p>
              <ul className="mt-1 space-y-1">
                {problem.issues
                  .filter((issue) => issue.order === order)
                  .map((issue, index) => (
                    <li
                      key={`${issue.path}-${String(index)}`}
                      className="flex flex-wrap items-baseline gap-x-2"
                    >
                      {type && issue.path !== '' ? (
                        <span className="text-muted">
                          {describePath(type, issue.path)}:
                        </span>
                      ) : null}
                      <span>{issue.message}</span>
                      {order >= 0 && onJumpToIssue ? (
                        <button
                          type="button"
                          className="text-accent underline"
                          onClick={() => onJumpToIssue(order, issue.path)}
                        >
                          {t('editorial.problem.goToField')}
                        </button>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {editorHref && !onJumpToIssue ? (
        <Link
          to={editorHref}
          className="mt-2 inline-block text-accent underline"
        >
          {t('editorial.problem.openEditor')}
        </Link>
      ) : null}
    </>
  );
}

/** O erro de uma ação editorial, escrito de um jeito que dá para agir. */
export function ProblemPanel({
  problem,
  stepTypes,
  onJumpToIssue,
  editorHref,
  onDismiss,
}: ProblemPanelProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-ink"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-error">{t('editorial.problem.title')}</p>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {t('editorial.problem.dismiss')}
        </Button>
      </div>

      <div className="mt-2">
        {problem.kind === 'validation' ? (
          <ValidationList
            problem={problem}
            stepTypes={stepTypes}
            onJumpToIssue={onJumpToIssue}
            editorHref={editorHref}
          />
        ) : problem.kind === 'references' ? (
          <>
            <p>{t('editorial.problem.references')}</p>
            <ul className="mt-2 space-y-1">
              {Object.entries(problem.missing).map(([key, list]) => (
                <li key={key}>
                  <span className="font-medium">
                    {REFERENCE_LABELS[key] ? t(REFERENCE_LABELS[key]) : key}:
                  </span>{' '}
                  <span className="font-mono text-xs">{list.join(', ')}</span>
                </li>
              ))}
            </ul>
          </>
        ) : problem.kind === 'qa' ? (
          <>
            <p>{t('editorial.problem.qa')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {problem.blockers.map((blocker, index) => (
                <li key={`${blocker.code}-${String(index)}`}>
                  {blocker.message}
                </li>
              ))}
            </ul>
          </>
        ) : problem.kind === 'audio' ? (
          <>
            <p>{t('editorial.problem.audio')}</p>
            {problem.missing.length > 0 ? (
              <p className="mt-1 text-muted">
                {t('editorial.problem.audioMissing', {
                  list: problem.missing.join(', '),
                })}
              </p>
            ) : null}
          </>
        ) : (
          <p>{problem.message}</p>
        )}
      </div>
    </div>
  );
}
