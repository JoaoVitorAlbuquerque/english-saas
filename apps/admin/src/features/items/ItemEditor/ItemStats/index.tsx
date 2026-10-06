import type { AdminItemDetail, ItemStats } from '@english-saas/api-client';
import { Badge, Button, ErrorState, Skeleton } from '@english-saas/ui';
import type { ITEM_CALIBRATION_FLAGS } from '@english-saas/shared';
import { Link } from 'react-router-dom';

import { t, type MessageKey } from '../../../../messages/pt-BR';
import { StatusBadge } from '../../../curriculum/components/StatusBadge';
import { formatDate, formatDifficulty, formatPercent } from '../../lib/format';
import { useItemStatsController } from './useItemStatsController';

/** Menos que isso e o servidor nem calcula a taxa de acerto. */
const MIN_RATE_EXPOSURE = 10;

const FLAG_LABELS: Record<(typeof ITEM_CALIBRATION_FLAGS)[number], MessageKey> =
  {
    TOO_EASY: 'items.stats.flag.TOO_EASY',
    TOO_HARD: 'items.stats.flag.TOO_HARD',
    LOW_DISCRIMINATION: 'items.stats.flag.LOW_DISCRIMINATION',
  };

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ground px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-base text-ink">{value}</dd>
    </div>
  );
}

function Difficulty({ stats }: { stats: ItemStats }) {
  const delta = stats.difficulty - stats.initialDifficulty;
  const calibrated = stats.history.length > 0;

  return (
    <div className="rounded-lg bg-ground px-3 py-2 sm:col-span-2">
      <dt className="text-xs text-muted">{t('items.stats.difficulty')}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-ink">
        <span>
          {t('items.stats.initial')}{' '}
          <span className="font-mono">
            {formatDifficulty(stats.initialDifficulty)}
          </span>
        </span>
        <span aria-hidden="true">→</span>
        <span>
          {t('items.stats.current')}{' '}
          <span className="font-mono">
            {formatDifficulty(stats.difficulty)}
          </span>
        </span>
        <span className="text-xs text-muted">
          {calibrated
            ? t('items.stats.delta', { delta: formatDifficulty(delta) })
            : t('items.stats.notCalibrated')}
        </span>
      </dd>
    </div>
  );
}

function History({ stats }: { stats: ItemStats }) {
  if (stats.history.length === 0) {
    return null;
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted hover:text-ink">
        {t('items.stats.history', { count: stats.history.length })}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <caption className="sr-only">
            {t('items.stats.historyCaption')}
          </caption>
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-3 font-medium">
                {t('items.stats.col.date')}
              </th>
              <th className="py-1 pr-3 font-medium">
                {t('items.stats.col.responses')}
              </th>
              <th className="py-1 pr-3 font-medium">
                {t('items.stats.col.p')}
              </th>
              <th className="py-1 pr-3 font-medium">
                {t('items.stats.col.estimated')}
              </th>
              <th className="py-1 pr-3 font-medium">
                {t('items.stats.col.applied')}
              </th>
              <th className="py-1 pr-3 font-medium">
                {t('items.stats.col.pb')}
              </th>
              <th className="py-1 font-medium">{t('items.stats.col.flags')}</th>
            </tr>
          </thead>
          <tbody>
            {[...stats.history].reverse().map((row) => (
              <tr key={row.calibratedAt} className="border-t border-line">
                <td className="py-1 pr-3">{formatDate(row.calibratedAt)}</td>
                <td className="py-1 pr-3 font-mono">{row.responses}</td>
                <td className="py-1 pr-3 font-mono">
                  {formatPercent(row.pValue)}
                </td>
                <td className="py-1 pr-3 font-mono">
                  {formatDifficulty(row.estimatedDifficulty)}
                </td>
                <td className="py-1 pr-3 font-mono">
                  {formatDifficulty(row.previousDifficulty)} →{' '}
                  {formatDifficulty(row.appliedDifficulty)}
                </td>
                <td className="py-1 pr-3 font-mono">
                  {row.pointBiserial === null
                    ? '—'
                    : row.pointBiserial.toFixed(2)}
                </td>
                <td className="py-1">
                  {row.flags.length === 0
                    ? '—'
                    : row.flags.map((flag) => t(FLAG_LABELS[flag])).join(', ')}
                  {row.resolvedAt === null || row.flags.length === 0
                    ? ''
                    : ` (${t('items.stats.resolved')})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function UsedIn({ item }: { item: AdminItemDetail }) {
  return (
    <section className="space-y-2" aria-label={t('items.usedIn.title')}>
      <h4 className="text-sm font-medium text-ink">
        {t('items.usedIn.title')}
      </h4>
      {item.usedIn.length === 0 ? (
        <p className="text-xs text-muted">{t('items.usedIn.none')}</p>
      ) : (
        <>
          <ul className="space-y-1">
            {item.usedIn.map((use) => (
              <li
                key={use.versionId}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <Link
                  to={`/conteudo/versoes/${use.versionId}`}
                  className="text-accent underline"
                >
                  {t('items.usedIn.lesson', {
                    title: use.title,
                    version: use.version,
                  })}
                </Link>
                <StatusBadge status={use.status} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t('items.usedIn.hint')}</p>
        </>
      )}
    </section>
  );
}

/**
 * A ficha de estatística do item: exposição, acerto, dificuldade com que
 * começou × a de hoje, o alerta de item problemático e onde ele está em uso.
 * O item novo ainda não tem nada disso.
 */
export function ItemStatsPanel({
  item,
  onResolved,
}: {
  item: AdminItemDetail | null;
  onResolved?: () => void;
}) {
  const controller = useItemStatsController(item?.id ?? null, onResolved);

  if (item === null) {
    return <p className="text-sm text-muted">{t('items.stats.newItem')}</p>;
  }

  const { stats } = controller;

  return (
    <div className="space-y-4">
      {controller.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : controller.error || stats === undefined ? (
        <ErrorState
          title={t('items.stats.loadError')}
          description={controller.error?.message ?? ''}
          onRetry={controller.retry}
        />
      ) : (
        <>
          {stats.flags.length > 0 ? (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-error bg-error/10 p-3"
            >
              <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                <Badge tone="error">{t('items.stats.problematic')}</Badge>
                {t('items.stats.problematicHint')}
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink">
                {stats.flags.map((flag) => (
                  <li key={flag}>{t(FLAG_LABELS[flag])}</li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="ghost"
                isLoading={controller.isResolving}
                onClick={controller.resolve}
              >
                {t('items.stats.resolve')}
              </Button>
              {controller.resolveError ? (
                <p className="text-sm text-error">{controller.resolveError}</p>
              ) : null}
            </div>
          ) : null}

          <dl className="grid gap-2 sm:grid-cols-2">
            <Figure
              label={t('items.stats.exposure')}
              value={String(stats.exposureCount)}
            />
            <Figure
              label={t('items.stats.correctRate')}
              value={
                stats.correctRate === null
                  ? t('items.stats.fewData', { min: MIN_RATE_EXPOSURE })
                  : formatPercent(stats.correctRate)
              }
            />
            <Difficulty stats={stats} />
            <Figure
              label={t('items.stats.discrimination')}
              value={stats.discrimination.toFixed(2)}
            />
            <Figure
              label={t('items.stats.lastCalibration')}
              value={
                stats.lastCalibratedAt === null
                  ? t('items.stats.never')
                  : formatDate(stats.lastCalibratedAt)
              }
            />
          </dl>

          <History stats={stats} />
        </>
      )}

      <UsedIn item={item} />
    </div>
  );
}
