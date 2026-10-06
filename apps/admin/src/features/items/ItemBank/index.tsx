import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from '@english-saas/ui';
import {
  CEFR_LEVELS,
  CONTENT_STATUSES,
  ITEM_CALIBRATION_FLAGS,
  ITEM_SOURCE_LABELS,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  LISTED_ITEM_SOURCES,
  type CefrLevel,
  type ContentStatus,
  type ItemCalibrationFlag,
  type ItemType,
  type ListedItemSource,
} from '@english-saas/shared';
import { ArrowLeft, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t, type MessageKey } from '../../../messages/pt-BR';
import { SkillPicker } from '../../curriculum/components/SkillPicker';
import { StatusBadge } from '../../curriculum/components/StatusBadge';
import { LoadMore } from '../../taxonomy/components/LoadMore';
import { formatDifficulty, formatPercent } from '../lib/format';
import { useItemBankController } from './useItemBankController';

const FLAG_LABELS: Record<ItemCalibrationFlag, MessageKey> = {
  TOO_EASY: 'items.stats.flag.TOO_EASY',
  TOO_HARD: 'items.stats.flag.TOO_HARD',
  LOW_DISCRIMINATION: 'items.stats.flag.LOW_DISCRIMINATION',
};

function sourceLabel(source: string): string {
  return source in ITEM_SOURCE_LABELS
    ? ITEM_SOURCE_LABELS[source as ListedItemSource]
    : source;
}

export function ItemBank() {
  const controller = useItemBankController();
  const { filters } = controller;
  // No modo "problemáticos" a fila filtra por marca, nível e tipo: o resto
  // não se aplica a ela (mora no módulo 8, não no banco).
  const onlyFlagged = filters.problematic;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        to="/conteudo"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('items.bank.back')}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">
            {t('items.bank.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {t('items.bank.subtitle')}
          </p>
        </div>
        <Link
          to="/conteudo/questoes/nova"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-base font-medium text-white hover:opacity-90"
        >
          <Plus className="size-5" aria-hidden="true" />
          {t('items.bank.new')}
        </Link>
      </header>

      <section
        aria-label={t('taxonomy.filters')}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          label={t('taxonomy.filter.search')}
          placeholder={t('items.bank.searchPlaceholder')}
          value={filters.q}
          disabled={onlyFlagged}
          onChange={(event) => controller.setFilter('q', event.target.value)}
        />
        <Select
          label={t('items.field.type')}
          value={filters.type}
          onChange={(event) =>
            controller.setFilter('type', event.target.value as ItemType | '')
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...ITEM_TYPES.map((type) => ({
              value: type,
              label: ITEM_TYPE_LABELS[type],
            })),
          ]}
        />
        <Select
          label={t('content.level.label')}
          value={filters.level}
          onChange={(event) =>
            controller.setFilter('level', event.target.value as CefrLevel | '')
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...CEFR_LEVELS.map((level) => ({ value: level, label: level })),
          ]}
        />
        <Select
          label={t('items.bank.status')}
          value={filters.status}
          disabled={onlyFlagged}
          onChange={(event) =>
            controller.setFilter(
              'status',
              event.target.value as ContentStatus | '',
            )
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...CONTENT_STATUSES.map((status) => ({
              value: status,
              label: t(`content.status.${status}`),
            })),
          ]}
        />
        <Select
          label={t('items.bank.source')}
          value={filters.source}
          disabled={onlyFlagged}
          onChange={(event) =>
            controller.setFilter('source', event.target.value)
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...LISTED_ITEM_SOURCES.map((source) => ({
              value: source,
              label: ITEM_SOURCE_LABELS[source],
            })),
          ]}
        />
        <div className="sm:col-span-2">
          <SkillPicker
            label={t('items.bank.skill')}
            value={filters.skillId}
            disabled={onlyFlagged}
            onChange={(skillId) => controller.setFilter('skillId', skillId)}
          />
        </div>
        <div className="flex flex-col justify-end gap-1">
          <Checkbox
            label={t('items.bank.problematic')}
            checked={onlyFlagged}
            onCheckedChange={(checked) =>
              controller.setFilter('problematic', checked)
            }
          />
          {onlyFlagged ? (
            <Select
              label={t('items.bank.flag')}
              value={filters.flag}
              onChange={(event) =>
                controller.setFilter(
                  'flag',
                  event.target.value as ItemCalibrationFlag | '',
                )
              }
              options={[
                { value: '', label: t('taxonomy.filter.any') },
                ...ITEM_CALIBRATION_FLAGS.map((flag) => ({
                  value: flag,
                  label: t(FLAG_LABELS[flag]),
                })),
              ]}
            />
          ) : null}
        </div>
      </section>
      {onlyFlagged ? (
        <p className="-mt-3 text-xs text-muted">
          {t('items.bank.problematicHint')}
        </p>
      ) : null}

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('content.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.rows.length === 0 ? (
        <EmptyState
          title={
            onlyFlagged
              ? t('items.bank.empty.flagged')
              : t('items.bank.empty.title')
          }
          description={
            controller.hasFilters
              ? t('taxonomy.empty.filtered')
              : t('items.bank.empty.description')
          }
          {...(controller.hasFilters
            ? {
                action: (
                  <Button variant="ghost" onClick={controller.clearFilters}>
                    {t('taxonomy.filter.clear')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">{t('items.bank.caption')}</caption>
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('items.bank.col.prompt')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('items.field.type')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('content.level.label')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('items.bank.status')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('items.bank.source')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('items.stats.exposure')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('items.bank.col.rate')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('items.bank.col.difficulty')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('items.bank.col.alert')}
                </th>
              </tr>
            </thead>
            <tbody>
              {controller.rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="max-w-xs px-3 py-2">
                    <Link
                      to={`/conteudo/questoes/${row.id}`}
                      className="line-clamp-2 text-accent underline"
                    >
                      {row.prompt}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{ITEM_TYPE_LABELS[row.type]}</td>
                  <td className="px-3 py-2">{row.cefrLevel}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2">{sourceLabel(row.source)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.exposureCount}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.correctRate === null
                      ? '—'
                      : formatPercent(row.correctRate)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatDifficulty(row.difficulty)}
                  </td>
                  <td className="px-3 py-2">
                    {row.flags.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <ul className="flex flex-wrap gap-1">
                        {row.flags.map((flag) => (
                          <li key={flag}>
                            <Badge tone="error">{t(FLAG_LABELS[flag])}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LoadMore
        hasMore={controller.hasMore}
        isLoading={controller.isLoadingMore}
        onLoad={controller.loadMore}
      />
    </div>
  );
}
