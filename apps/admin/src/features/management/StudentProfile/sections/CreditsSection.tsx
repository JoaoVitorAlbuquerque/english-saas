import { Badge, Button } from '@english-saas/ui';
import { Gift } from 'lucide-react';

import { t } from '../../../../messages/pt-BR';
import { LoadMore } from '../../../taxonomy/components/LoadMore';
import { Section } from '../../components/Section';
import { creditActionLabel, formatDateTime, formatInt } from '../../lib/labels';
import type { StudentProfileView } from '../useStudentProfileController';

export function CreditsSection({
  credits,
  ledger,
  onGrant,
}: {
  credits: StudentProfileView['credits'];
  ledger: StudentProfileView['ledger'];
  onGrant: () => void;
}) {
  const balance = credits.data;

  return (
    <Section
      id="student-credits"
      title={t('student.credits.title')}
      isLoading={credits.isLoading}
      error={credits.error}
      onRetry={credits.retry}
      actions={
        <Button
          leftIcon={<Gift className="size-4" aria-hidden="true" />}
          onClick={onGrant}
        >
          {t('student.credits.grant')}
        </Button>
      }
    >
      {balance ? (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">
                {t('student.credits.balance')}
              </dt>
              <dd className="font-mono text-2xl text-ink">
                {formatInt(balance.balance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">
                {t('student.credits.quota')}
              </dt>
              <dd className="font-mono text-2xl text-ink">
                {formatInt(balance.monthlyAiCredits)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">
                {t('student.credits.nextGrant')}
              </dt>
              <dd className="text-ink">
                {formatDateTime(balance.nextGrantAt)}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-1 text-sm font-medium text-ink">
              {t('student.credits.costs')}
            </h3>
            <ul className="flex flex-wrap gap-2 text-sm">
              {Object.entries(balance.costs).map(([feature, cost]) => (
                <li key={feature}>
                  <Badge tone="muted">
                    {creditActionLabel(feature)}: {cost}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-ink">
          {t('student.credits.history')}
        </h3>
        {ledger.isLoading ? null : ledger.error ? (
          <p role="alert" className="text-sm text-error">
            {ledger.error.message}{' '}
            <Button size="sm" variant="ghost" onClick={ledger.retry}>
              {t('mgmt.retry')}
            </Button>
          </p>
        ) : ledger.rows.length === 0 ? (
          <p className="text-sm text-muted">
            {t('student.credits.historyEmpty')}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">
                  {t('student.credits.historyCaption')}
                </caption>
                <thead className="text-xs text-muted">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t('student.credits.col.date')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t('student.credits.col.kind')}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      {t('student.credits.col.amount')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t('student.credits.col.feature')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t('student.credits.col.reason')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t border-line align-top"
                    >
                      <td className="whitespace-nowrap py-2 pr-3">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        {t(`student.credits.kind.${entry.kind}`)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {entry.amount > 0 ? '+' : ''}
                        {entry.amount}
                      </td>
                      <td className="px-3 py-2">
                        {entry.feature === null
                          ? '—'
                          : creditActionLabel(entry.feature)}
                      </td>
                      <td className="px-3 py-2">{entry.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LoadMore
              hasMore={ledger.hasMore}
              isLoading={ledger.isLoadingMore}
              onLoad={ledger.loadMore}
            />
          </>
        )}
      </div>
    </Section>
  );
}
