import { Card, EmptyState, ErrorState, Skeleton } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { CostsCard } from './CostsCard';
import { PlanRow } from './PlanRow';
import { usePlansController } from './usePlansController';

export function Plans() {
  const controller = usePlansController();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-ink">{t('plans.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t('plans.subtitle')}
        </p>
      </header>

      <Card role="region" aria-labelledby="plans-table" className="space-y-4">
        <h2 id="plans-table" className="font-display text-lg text-ink">
          {t('plans.table.caption')}
        </h2>

        {controller.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : controller.error ? (
          <ErrorState
            title={t('mgmt.loadError')}
            description={controller.error.message}
            onRetry={controller.retry}
          />
        ) : controller.plans.length === 0 ? (
          <EmptyState title={t('plans.empty')} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <caption className="sr-only">
                  {t('plans.table.caption')}
                </caption>
                <thead className="text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t('plans.col.plan')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t('plans.col.price')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t('plans.col.credits')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t('plans.col.active')}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      <span className="sr-only">{t('plans.col.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {controller.plans.map((plan) => (
                    <PlanRow
                      key={`${plan.id}:${String(plan.priceCents)}:${String(plan.monthlyAiCredits)}:${String(plan.active)}`}
                      plan={plan}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              <li>{t('plans.note.price')}</li>
              <li>{t('plans.note.credits')}</li>
              <li>{t('plans.note.inactive')}</li>
            </ul>
          </>
        )}
      </Card>

      <CostsCard />
    </div>
  );
}
