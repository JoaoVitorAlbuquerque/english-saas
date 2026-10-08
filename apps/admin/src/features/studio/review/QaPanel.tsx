import type { LevelStats } from '@english-saas/api-client';
import { Badge, Button, ErrorState, Skeleton } from '@english-saas/ui';
import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import type { LocatedWarning, QaController } from './useQaController';

export type QaJumps = {
  /** Abre a etapa e foca o campo (o mesmo `jumpToIssue` do editor). */
  onJumpStep: (order: number, fieldPath: string) => void;
  onJumpMeta: (field: string | null) => void;
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function percent(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`;
}

function LevelSummary({ stats, level }: { stats: LevelStats; level: string }) {
  const total = stats.totalWords ?? 0;

  if (total === 0) {
    return <p className="text-sm text-muted">{t('studio.qa.level.empty')}</p>;
  }

  const outOfLevel = stats.outOfLevel ?? [];

  return (
    <div className="space-y-2" data-testid="qa-level-stats">
      <p className="text-sm text-ink">
        {t('studio.qa.level.summary', {
          percent: percent(stats.ratio ?? 0),
          level,
          count: stats.outOfLevelCount ?? outOfLevel.length,
          total,
        })}
      </p>
      {stats.coverage !== undefined ? (
        <p className="text-xs text-muted">
          {t('studio.qa.level.coverage', { percent: percent(stats.coverage) })}
        </p>
      ) : null}
      {outOfLevel.length > 0 ? (
        <ul
          aria-label={t('studio.qa.level.words')}
          className="flex flex-wrap gap-1"
        >
          {outOfLevel.map((entry) => (
            <li key={entry.word}>
              <Badge tone="muted">
                {entry.word} · {entry.band}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function JumpAction({
  warning,
  jumps,
}: {
  warning: LocatedWarning;
  jumps: QaJumps;
}) {
  const location = warning.location;

  if (location.kind === 'step') {
    return (
      <button
        type="button"
        className="text-accent underline"
        onClick={() => jumps.onJumpStep(location.stepOrder, location.fieldPath)}
      >
        {t('studio.qa.goToText')}
      </button>
    );
  }

  if (location.kind === 'item') {
    return location.itemId === null ? null : (
      <Link
        to={`/conteudo/questoes/${location.itemId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline"
      >
        {t('studio.qa.openItem')}
      </Link>
    );
  }

  if (location.kind === 'meta') {
    return (
      <button
        type="button"
        className="text-accent underline"
        onClick={() => jumps.onJumpMeta(location.field)}
      >
        {t('studio.qa.goToMeta')}
      </button>
    );
  }

  return null;
}

function WarningGroup({
  title,
  warnings,
  tone,
  jumps,
}: {
  title: string;
  warnings: LocatedWarning[];
  tone: 'error' | 'muted';
  jumps: QaJumps;
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="flex items-center gap-2 font-display text-sm text-ink">
        {title}
        <Badge tone={tone}>{warnings.length}</Badge>
      </h3>
      <ul className="space-y-2">
        {warnings.map((warning, index) => (
          <li
            key={`${warning.code}-${warning.path ?? ''}-${String(index)}`}
            className="rounded-xl border border-line bg-surface p-3 text-sm"
          >
            <p className="text-ink">{warning.message}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-muted">
              <span>{warning.location.label}</span>
              <JumpAction warning={warning} jumps={jumps} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A revisão automática ao lado do editor: o que travou, o que avisa e o nível. */
export function QaPanel({
  controller,
  level,
  jumps,
  canRun,
}: {
  controller: QaController;
  level: string;
  jumps: QaJumps;
  canRun: boolean;
}) {
  const report = controller.report;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-ink">
            {t('studio.qa.title')}
          </h2>
          {report ? (
            <p className="text-xs text-muted">
              {t('studio.qa.ranAt', {
                date: dateFormat.format(new Date(report.ranAt)),
              })}
            </p>
          ) : null}
        </div>
        {canRun ? (
          <Button
            size="sm"
            variant="ghost"
            isLoading={controller.isRunning}
            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
            onClick={controller.run}
          >
            {controller.isRunning ? t('studio.qa.running') : t('studio.qa.run')}
          </Button>
        ) : null}
      </div>

      {controller.runError ? (
        <p role="alert" className="text-sm text-error">
          {controller.runError.message}
        </p>
      ) : null}

      {controller.stale ? (
        <p
          role="status"
          className="rounded-xl border border-line bg-chunk-bg p-3 text-sm text-ink"
        >
          {t('studio.qa.stale')}
        </p>
      ) : null}

      {controller.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('studio.qa.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : report === null ? (
        <p className="text-sm text-muted">{t('studio.qa.never')}</p>
      ) : (
        <>
          <LevelSummary stats={report.levelStats} level={level} />

          {controller.blockers.length === 0 ? (
            <p className="text-sm text-ok">{t('studio.qa.noBlockers')}</p>
          ) : null}

          <WarningGroup
            title={t('studio.qa.blockers')}
            warnings={controller.blockers}
            tone="error"
            jumps={jumps}
          />
          <WarningGroup
            title={t('studio.qa.warnings')}
            warnings={controller.warnings}
            tone="muted"
            jumps={jumps}
          />
          <WarningGroup
            title={t('studio.qa.infos')}
            warnings={controller.infos}
            tone="muted"
            jumps={jumps}
          />
        </>
      )}
    </div>
  );
}
