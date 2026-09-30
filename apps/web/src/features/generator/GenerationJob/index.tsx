import { Card, cn, ErrorState, Skeleton } from '@english-saas/ui';
import { Check, Circle, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LINK_BUTTON_CLASS } from '../components/link-button';
import type { PhaseStatus } from '../lib/job-phases';
import { useGenerationJobController } from './useGenerationJobController';

const PHASE_ICON: Record<PhaseStatus, typeof Check> = {
  DONE: Check,
  RUNNING: Loader2,
  PENDING: Circle,
  FAILED: X,
};

const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  DONE: 'concluído',
  RUNNING: 'em andamento',
  PENDING: 'a fazer',
  FAILED: 'não deu certo',
};

export function GenerationJob() {
  const {
    isLoading,
    isError,
    retry,
    phases,
    message,
    failed,
    materialId,
    retryPath,
  } = useGenerationJobController();

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (isError) {
    return <ErrorState title={t('job.errorTitle')} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl text-ink">{t('job.title')}</h1>

      <Card className="flex flex-col gap-4">
        <ol className="flex flex-col gap-3" aria-label={t('job.title')}>
          {phases.map((phase) => {
            const Icon = PHASE_ICON[phase.status];
            return (
              <li
                key={phase.key}
                className="flex items-center gap-3"
                aria-current={phase.status === 'RUNNING' ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border',
                    phase.status === 'DONE' && 'border-ok bg-ok/10 text-ok',
                    phase.status === 'RUNNING' &&
                      'border-accent bg-accent/10 text-accent',
                    phase.status === 'PENDING' && 'border-line text-muted',
                    phase.status === 'FAILED' &&
                      'border-error bg-error/10 text-error',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4',
                      phase.status === 'RUNNING' && 'animate-spin',
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={cn(
                    'text-sm',
                    phase.status === 'PENDING' ? 'text-muted' : 'text-ink',
                  )}
                >
                  {phase.label}
                  <span className="sr-only">
                    {' '}
                    — {PHASE_STATUS_LABEL[phase.status]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <p
          role={failed ? 'alert' : 'status'}
          className={cn('text-sm', failed ? 'text-ink' : 'text-muted')}
        >
          {message}
        </p>
      </Card>

      {failed ? (
        <div className="flex flex-wrap gap-3">
          <Link to={retryPath} className={LINK_BUTTON_CLASS}>
            {t('job.tryAgain')}
          </Link>
          <Link
            to="/ferramentas"
            className="inline-flex h-11 items-center text-sm font-medium text-accent underline"
          >
            {t('job.backToTools')}
          </Link>
        </div>
      ) : materialId !== null ? (
        <Link to={`/materiais/${materialId}`} className={LINK_BUTTON_CLASS}>
          {t('job.openMaterial')}
        </Link>
      ) : (
        <p className="text-sm text-muted">{t('job.leaveHint')}</p>
      )}
    </div>
  );
}
