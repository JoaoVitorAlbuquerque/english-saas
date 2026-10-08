import type { WorkbookRow } from '@english-saas/api-client';
import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  type BadgeTone,
} from '@english-saas/ui';
import { Download, RefreshCw } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import {
  useWorkbookRowController,
  useWorkbooksController,
  type WorkbookStatus,
} from './useWorkbooksController';

const TONES: Record<WorkbookStatus, BadgeTone> = {
  NONE: 'muted',
  GENERATING: 'accent',
  FAILED: 'error',
  STALE: 'error',
  UP_TO_DATE: 'ok',
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatSize(bytes: number | null): string {
  return bytes === null ? '—' : `${(bytes / 1024).toFixed(0)} KB`;
}

function WorkbookLine({ row }: { row: WorkbookRow }) {
  const controller = useWorkbookRowController(row);
  const workbook = row.workbook;

  return (
    <tr aria-label={row.unit.title} className="border-t border-line align-top">
      <td className="px-3 py-2">{row.cefrLevel}</td>
      <td className="px-3 py-2">
        <p className="text-ink">{row.unit.title}</p>
        <p className="font-mono text-xs text-muted">{row.unit.slug}</p>
      </td>
      <td className="px-3 py-2 text-right font-mono">{row.publishedLessons}</td>
      <td className="px-3 py-2">
        <Badge tone={TONES[controller.status]}>
          {t(`studio.workbooks.status.${controller.status}`)}
        </Badge>
        {controller.status === 'STALE' ? (
          <p className="mt-1 max-w-xs text-xs text-muted">
            {t('studio.workbooks.staleHint')}
          </p>
        ) : null}
        {controller.status === 'FAILED' ? (
          <p role="alert" className="mt-1 max-w-xs text-xs text-error">
            {controller.failedReason ?? t('studio.workbooks.failedUnknown')}
          </p>
        ) : null}
        {controller.requestError ? (
          <p role="alert" className="mt-1 max-w-xs text-xs text-error">
            {controller.requestError}
          </p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {workbook?.generatedAt
          ? dateFormat.format(new Date(workbook.generatedAt))
          : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {formatSize(workbook?.sizeBytes ?? null)}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap justify-end gap-2">
          {workbook?.url ? (
            <a
              href={workbook.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t('studio.workbooks.download')}: ${row.unit.title}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-ground"
            >
              <Download className="size-4" aria-hidden="true" />
              {t('studio.workbooks.download')}
            </a>
          ) : null}
          <Button
            size="sm"
            variant={controller.status === 'STALE' ? 'primary' : 'ghost'}
            disabled={!controller.canRegenerate}
            isLoading={controller.running}
            aria-label={`${workbook === null ? t('studio.workbooks.generate') : t('studio.workbooks.regenerate')}: ${row.unit.title}`}
            onClick={controller.start}
          >
            {workbook === null
              ? t('studio.workbooks.generate')
              : t('studio.workbooks.regenerate')}
          </Button>
        </div>
        {row.publishedLessons === 0 ? (
          <p className="mt-1 text-right text-xs text-muted">
            {t('studio.workbooks.noLessons')}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

export function Workbooks() {
  const controller = useWorkbooksController();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          {t('studio.workbooks.intro')}
        </p>
        <div className="flex items-end gap-2">
          <Select
            label={t('content.level.label')}
            value={controller.level}
            onChange={(event) =>
              controller.setLevel(event.target.value as CefrLevel | '')
            }
            options={[
              { value: '', label: t('taxonomy.filter.any') },
              ...CEFR_LEVELS.map((level) => ({ value: level, label: level })),
            ]}
          />
          <Button
            variant="ghost"
            isLoading={controller.isRefreshing}
            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
            onClick={controller.refresh}
          >
            {t('studio.queue.refresh')}
          </Button>
        </div>
      </div>

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
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
          title={t('studio.workbooks.empty.title')}
          description={t('studio.workbooks.empty.description')}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">
              {t('studio.workbooks.caption')}
            </caption>
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('content.level.label')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.workbooks.col.unit')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('studio.workbooks.col.lessons')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.workbooks.col.status')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.workbooks.col.generatedAt')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('studio.workbooks.col.size')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">
                    {t('studio.queue.col.actions')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {controller.rows.map((row) => (
                <WorkbookLine key={row.unit.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
