import { LESSON_STEP_TYPE_LABELS } from '@english-saas/shared';

import { t } from '../../../messages/pt-BR';
import { describePath } from '../lib/validation';
import type { VersionDiff } from '../lib/version-diff';

function Change({ before, after }: { before: string; after: string }) {
  const blank = t('lesson.compare.blank');

  return (
    <div className="grid gap-1 text-sm sm:grid-cols-2">
      <p className="rounded-lg bg-error/5 px-2 py-1 text-ink">
        <span className="sr-only">{t('lesson.compare.before')}: </span>
        <span className="line-through decoration-error/50">
          {before === '' ? blank : before}
        </span>
      </p>
      <p className="rounded-lg bg-ok/5 px-2 py-1 text-ink">
        <span className="sr-only">{t('lesson.compare.after')}: </span>
        {after === '' ? blank : after}
      </p>
    </div>
  );
}

/** O que mudou entre duas versões: metadados, skills e, por etapa, campo a campo. */
export function VersionDiffView({ diff }: { diff: VersionDiff }) {
  if (diff.isEmpty) {
    return <p className="text-sm text-muted">{t('lesson.compare.empty')}</p>;
  }

  return (
    <div className="space-y-5">
      {diff.meta.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-medium text-ink">{t('lesson.compare.meta')}</h3>
          {diff.meta.map((change) => (
            <div key={change.field} className="space-y-1">
              <p className="text-xs font-medium text-muted">
                {t(`lesson.compare.meta.${change.field}`)}
              </p>
              <Change before={change.before} after={change.after} />
            </div>
          ))}
        </section>
      ) : null}

      {diff.skillsAdded.length > 0 || diff.skillsRemoved.length > 0 ? (
        <section className="space-y-1">
          <h3 className="font-medium text-ink">{t('lesson.compare.skills')}</h3>
          {diff.skillsAdded.length > 0 ? (
            <p className="text-sm text-ok">
              {t('lesson.compare.skillsAdded', {
                list: diff.skillsAdded.join(', '),
              })}
            </p>
          ) : null}
          {diff.skillsRemoved.length > 0 ? (
            <p className="text-sm text-error">
              {t('lesson.compare.skillsRemoved', {
                list: diff.skillsRemoved.join(', '),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      {diff.steps.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-medium text-ink">{t('lesson.compare.steps')}</h3>
          {diff.steps.map((step) => {
            const type = LESSON_STEP_TYPE_LABELS[step.type];
            const position = step.position + 1;

            return (
              <div key={step.position} className="space-y-2">
                <p className="text-sm font-medium text-ink">
                  {step.kind === 'added'
                    ? t('lesson.compare.stepAdded', { position, type })
                    : step.kind === 'removed'
                      ? t('lesson.compare.stepRemoved', { position, type })
                      : t('lesson.compare.stepChanged', { position, type })}
                </p>
                {step.kind === 'changed' ? (
                  <>
                    {step.typeChange ? (
                      <p className="text-sm text-muted">
                        {t('lesson.compare.typeChanged', {
                          from: LESSON_STEP_TYPE_LABELS[step.typeChange.from],
                          to: LESSON_STEP_TYPE_LABELS[step.typeChange.to],
                        })}
                      </p>
                    ) : null}
                    {step.fields.map((field) => (
                      <div key={field.path} className="space-y-1">
                        <p className="text-xs font-medium text-muted">
                          {describePath(step.type, field.path)}
                        </p>
                        <Change before={field.before} after={field.after} />
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {diff.unchangedSteps > 0 ? (
        <p className="text-sm text-muted">
          {t('lesson.compare.unchanged', { count: diff.unchangedSteps })}
        </p>
      ) : null}
    </div>
  );
}
