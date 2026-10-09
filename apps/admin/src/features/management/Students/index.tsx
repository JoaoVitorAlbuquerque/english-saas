import type { AdminUserRow } from '@english-saas/api-client';
import { ROLE_LABELS } from '@english-saas/shared';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  type BadgeTone,
} from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LoadMore } from '../../taxonomy/components/LoadMore';
import { formatDate, studentStatus, type StudentStatus } from '../lib/labels';
import { useStudentsController } from './useStudentsController';

const STATUS_TONES: Record<StudentStatus, BadgeTone> = {
  ACTIVE: 'ok',
  DELETED: 'error',
  ANONYMIZED: 'muted',
};

function StudentRow({ user }: { user: AdminUserRow }) {
  const status = studentStatus(user);

  return (
    <tr aria-label={user.name} className="border-t border-line align-top">
      <td className="px-3 py-2 text-ink">{user.name}</td>
      <td className="px-3 py-2 break-all">
        {user.email}
        {user.emailVerifiedAt === null && status === 'ACTIVE' ? (
          <p className="text-xs text-muted">{t('students.unverified')}</p>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <Badge tone={user.role === 'STUDENT' ? 'muted' : 'accent'}>
          {ROLE_LABELS[user.role]}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <Badge tone={STATUS_TONES[status]}>
          {t(`students.status.${status}`)}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {formatDate(user.createdAt)}
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          to={`/alunos/${user.id}`}
          aria-label={`${t('students.open')}: ${user.name}`}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90"
        >
          {t('students.open')}
        </Link>
      </td>
    </tr>
  );
}

export function Students() {
  const controller = useStudentsController();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-ink">
          {t('students.title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t('students.subtitle')}
        </p>
      </header>

      <div className="max-w-md">
        <Input
          type="search"
          label={t('students.search')}
          placeholder={t('students.search.placeholder')}
          value={controller.text}
          onChange={(event) => controller.setText(event.target.value)}
        />
        <p
          role="status"
          aria-live="polite"
          className="mt-1 h-4 text-xs text-muted"
        >
          {controller.isSearching ? t('students.searching') : ''}
        </p>
      </div>

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
          title={t('students.empty.title')}
          description={
            controller.searched === ''
              ? t('students.empty.description')
              : t('students.empty.search', { q: controller.searched })
          }
          action={
            controller.searched === '' ? undefined : (
              <Button variant="ghost" onClick={controller.clearSearch}>
                {t('students.clearSearch')}
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <caption className="sr-only">{t('students.caption')}</caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('students.col.name')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('students.col.email')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('students.col.role')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('students.col.status')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('students.col.createdAt')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">{t('students.col.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {controller.rows.map((user) => (
                  <StudentRow key={user.id} user={user} />
                ))}
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
