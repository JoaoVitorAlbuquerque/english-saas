import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LoadMore } from '../../taxonomy/components/LoadMore';
import { actionLabel, describeAudit, targetTypeLabel } from '../lib/audit-text';
import { formatDateTime } from '../lib/labels';
import { useAuditLogController } from './useAuditLogController';

export function AuditLog() {
  const controller = useAuditLogController();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-ink">{t('audit.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t('audit.subtitle')}
        </p>
      </header>

      <section
        aria-label={t('taxonomy.filters')}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-64">
          <Select
            label={t('audit.filter.action')}
            value={controller.filters.action}
            onChange={(event) =>
              controller.setFilter('action', event.target.value)
            }
            options={[
              { value: '', label: t('taxonomy.filter.any') },
              ...controller.actions.map((action) => ({
                value: action,
                label: actionLabel(action),
              })),
            ]}
          />
        </div>
        <div className="w-44">
          <Input
            type="date"
            label={t('audit.filter.from')}
            value={controller.filters.from}
            onChange={(event) =>
              controller.setFilter('from', event.target.value)
            }
          />
        </div>
        <div className="w-44">
          <Input
            type="date"
            label={t('audit.filter.to')}
            value={controller.filters.to}
            onChange={(event) => controller.setFilter('to', event.target.value)}
          />
        </div>
        {controller.hasFilters ? (
          <Button variant="ghost" onClick={controller.clearFilters}>
            {t('audit.filter.clear')}
          </Button>
        ) : null}
      </section>

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('mgmt.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.rows.length === 0 ? (
        <EmptyState
          title={t('audit.empty.title')}
          description={
            controller.hasFilters
              ? t('audit.empty.filtered')
              : t('audit.empty.description')
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">{t('audit.caption')}</caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('audit.col.when')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('audit.col.who')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('audit.col.action')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('audit.col.target')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('audit.col.details')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {controller.rows.map((entry) => {
                  const lines = describeAudit(entry);

                  return (
                    <tr
                      key={entry.id}
                      aria-label={`${actionLabel(entry.action)} — ${entry.actorEmail}`}
                      className="border-t border-line align-top"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="break-all px-3 py-2">
                        {entry.actorEmail}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone="accent">{actionLabel(entry.action)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-muted">
                          {targetTypeLabel(entry.targetType)}
                        </p>
                        {entry.targetType === 'user' && entry.targetId ? (
                          <Link
                            to={`/alunos/${entry.targetId}`}
                            className="break-all text-accent underline"
                          >
                            {entry.targetLabel ?? entry.targetId}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">
                            {entry.targetId ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {lines.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {lines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <LoadMore
            hasMore={controller.hasMore}
            isLoading={controller.isLoadingMore}
            onLoad={controller.loadMore}
          />
        </>
      )}
    </div>
  );
}
