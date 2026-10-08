import type { Draft } from '@english-saas/api-client';
import {
  DRAFT_KINDS,
  DRAFT_STATUSES,
  type DraftKind,
  type DraftStatus,
} from '@english-saas/shared';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  type BadgeTone,
} from '@english-saas/ui';
import { Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { ConfirmDialog } from '../../curriculum/components/ConfirmDialog';
import { LoadMore } from '../../taxonomy/components/LoadMore';
import { describeDraftError } from '../lib/draft-errors';
import { summarizeDraft } from '../lib/draft-summary';
import { formatUsdMicros } from '../lib/format-usd';
import { useDraftQueueController } from './useDraftQueueController';

const STATUS_TONES: Record<DraftStatus, BadgeTone> = {
  QUEUED: 'muted',
  GENERATING: 'accent',
  QA_RUNNING: 'accent',
  READY: 'ok',
  FAILED: 'error',
  DISCARDED: 'muted',
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function ReviewCounts({ draft }: { draft: Draft }) {
  const report = draft.qaReports[0];

  if (report === undefined || draft.kind === 'REGISTER_NOTES') {
    return <span className="text-muted">—</span>;
  }

  return (
    <ul className="flex flex-wrap gap-1" aria-label={t('studio.queue.qa')}>
      <li>
        <Badge tone={report.blockerCount > 0 ? 'error' : 'muted'}>
          {t('studio.queue.qa.blockers', { count: report.blockerCount })}
        </Badge>
      </li>
      <li>
        <Badge tone="muted">
          {t('studio.queue.qa.warnings', { count: report.warningCount })}
        </Badge>
      </li>
      <li>
        <Badge tone="muted">
          {t('studio.queue.qa.infos', { count: report.infoCount })}
        </Badge>
      </li>
    </ul>
  );
}

function CreatedList({ draft }: { draft: Draft }) {
  if (draft.kind === 'ITEMS') {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {draft.createdItemIds.map((id, index) => (
          <li key={id}>
            <Link
              to={`/conteudo/questoes/${id}`}
              className="text-accent underline"
            >
              {t('studio.queue.item', { n: index + 1 })}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-1">
      <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
        {draft.createdRegisterNoteIds.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
      <Link to="/conteudo/taxonomia/registro" className="text-accent underline">
        {t('studio.queue.openNotes')}
      </Link>
    </div>
  );
}

export function DraftQueue() {
  const controller = useDraftQueueController();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <section
          aria-label={t('taxonomy.filters')}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Select
            label={t('studio.queue.filter.status')}
            value={controller.filters.status}
            onChange={(event) =>
              controller.setFilter(
                'status',
                event.target.value as DraftStatus | '',
              )
            }
            options={[
              { value: '', label: t('taxonomy.filter.any') },
              ...DRAFT_STATUSES.map((status) => ({
                value: status,
                label: t(`studio.status.${status}`),
              })),
            ]}
          />
          <Select
            label={t('studio.queue.filter.kind')}
            value={controller.filters.kind}
            onChange={(event) =>
              controller.setFilter('kind', event.target.value as DraftKind | '')
            }
            options={[
              { value: '', label: t('taxonomy.filter.any') },
              ...DRAFT_KINDS.map((kind) => ({
                value: kind,
                label: t(`studio.kind.${kind}`),
              })),
            ]}
          />
        </section>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            isLoading={controller.isRefreshing}
            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
            onClick={controller.refresh}
          >
            {t('studio.queue.refresh')}
          </Button>
          <Link
            to="/estudio/novo"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-base font-medium text-white hover:opacity-90"
          >
            <Plus className="size-5" aria-hidden="true" />
            {t('studio.queue.new')}
          </Link>
        </div>
      </div>

      <p role="status" aria-live="polite" className="text-xs text-muted">
        {controller.hasActive
          ? t('studio.queue.autoRefresh')
          : t('studio.queue.idle')}
      </p>

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
          title={t('studio.queue.empty.title')}
          description={
            controller.hasFilters
              ? t('taxonomy.empty.filtered')
              : t('studio.queue.empty.description')
          }
          action={
            controller.hasFilters ? (
              <Button variant="ghost" onClick={controller.clearFilters}>
                {t('taxonomy.filter.clear')}
              </Button>
            ) : (
              <Link to="/estudio/novo" className="text-accent underline">
                {t('studio.queue.new')}
              </Link>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">{t('studio.queue.caption')}</caption>
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.queue.col.request')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.queue.col.status')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.queue.col.by')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.queue.col.at')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('studio.queue.col.cost')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('studio.queue.col.qa')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">
                    {t('studio.queue.col.actions')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {controller.rows.map((draft) => {
                const summary = summarizeDraft(draft);
                const open = controller.expanded === draft.id;
                const highlighted = draft.id === controller.highlightedId;
                const reviewable =
                  draft.status === 'READY' &&
                  draft.kind === 'LESSON' &&
                  draft.lessonVersionId !== null;
                const listable =
                  draft.status === 'READY' &&
                  draft.kind !== 'LESSON' &&
                  (draft.createdItemIds.length > 0 ||
                    draft.createdRegisterNoteIds.length > 0);

                return (
                  <tr
                    key={draft.id}
                    aria-label={summary}
                    data-highlighted={highlighted}
                    className={`border-t border-line align-top ${
                      highlighted ? 'bg-accent/5' : ''
                    }`}
                  >
                    <td className="max-w-sm px-3 py-2">
                      <p className="text-xs text-muted">
                        {t(`studio.kind.${draft.kind}`)}
                      </p>
                      <p className="line-clamp-2 text-ink">{summary}</p>
                      {draft.status === 'FAILED' ? (
                        <p role="alert" className="mt-1 text-xs text-error">
                          {describeDraftError(draft.errorCode)}
                        </p>
                      ) : null}
                      {open ? (
                        <div className="mt-2 text-xs">
                          <CreatedList draft={draft} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONES[draft.status]}>
                        {t(`studio.status.${draft.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {draft.requestedBy.name ?? t('studio.queue.unknownUser')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {dateFormat.format(new Date(draft.createdAt))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {draft.costUsdMicros === null
                        ? '—'
                        : formatUsdMicros(draft.costUsdMicros)}
                    </td>
                    <td className="px-3 py-2">
                      <ReviewCounts draft={draft} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        {reviewable ? (
                          <Link
                            to={`/conteudo/versoes/${draft.lessonVersionId as string}?painel=revisao`}
                            aria-label={`${t('studio.queue.review')}: ${summary}`}
                            className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90"
                          >
                            {t('studio.queue.review')}
                          </Link>
                        ) : null}
                        {listable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-expanded={open}
                            onClick={() => controller.toggleExpanded(draft.id)}
                          >
                            {open
                              ? t('studio.queue.hideCreated')
                              : t('studio.queue.showCreated')}
                          </Button>
                        ) : null}
                        {draft.status !== 'DISCARDED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`${t('studio.queue.discard')}: ${summary}`}
                            onClick={() => controller.requestDiscard(draft)}
                          >
                            {t('studio.queue.discard')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LoadMore
        hasMore={controller.hasMore}
        isLoading={controller.isLoadingMore}
        onLoad={controller.loadMore}
      />

      <ConfirmDialog
        open={controller.discarding !== null}
        title={t('studio.queue.discard.title')}
        description={
          controller.discarding === null
            ? ''
            : controller.discarding.kind === 'REGISTER_NOTES'
              ? t('studio.queue.discard.notes')
              : t('studio.queue.discard.description')
        }
        confirmLabel={t('studio.queue.discard')}
        danger
        isLoading={controller.isDiscarding}
        onConfirm={controller.confirmDiscard}
        onCancel={controller.cancelDiscard}
      />
    </div>
  );
}
