import { Badge, type BadgeTone } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { LoadMore } from '../../../taxonomy/components/LoadMore';
import { Section } from '../../components/Section';
import { formatDateTime } from '../../lib/labels';
import type { StudentProfileView } from '../useStudentProfileController';

const STATUS_TONES: Record<string, BadgeTone> = {
  COMPLETED: 'ok',
  IN_PROGRESS: 'accent',
  ABANDONED: 'muted',
};

export function HistorySection({
  history,
}: {
  history: StudentProfileView['history'];
}) {
  return (
    <Section
      id="student-history"
      title={t('student.history.title')}
      isLoading={history.isLoading}
      error={history.error}
      onRetry={history.retry}
    >
      {history.rows.length === 0 ? (
        <p className="text-sm text-muted">{t('student.history.empty')}</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">
                {t('student.history.caption')}
              </caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t('student.history.col.lesson')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('student.history.col.status')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('student.history.col.xp')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('student.history.col.startedAt')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('student.history.col.completedAt')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.rows.map((entry) => (
                  <tr
                    key={entry.attemptId}
                    className="border-t border-line align-top"
                  >
                    <td className="py-2 pr-3">
                      <span className="text-ink">
                        {entry.title ?? entry.lessonId}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {entry.cefrLevel ?? ''}{' '}
                        {t('student.history.version', {
                          version: entry.version,
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONES[entry.status] ?? 'muted'}>
                        {t(`student.history.status.${entry.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {entry.xpEarned}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateTime(entry.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {entry.completedAt === null
                        ? '—'
                        : formatDateTime(entry.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            hasMore={history.hasMore}
            isLoading={history.isLoadingMore}
            onLoad={history.loadMore}
          />
        </div>
      )}
    </Section>
  );
}
