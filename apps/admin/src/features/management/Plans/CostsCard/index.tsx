import {
  CREDIT_FEATURES,
  type CreditFeatureName,
} from '@english-saas/api-client';
import { Button, Card, ErrorState, Input, Skeleton } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { creditActionLabel } from '../../lib/labels';
import { useCostRowController } from './useCostRowController';
import { useCostsCardController } from './useCostsCardController';

function CostRow({
  feature,
  cost,
}: {
  feature: CreditFeatureName;
  cost: number;
}) {
  const row = useCostRowController(feature, cost);
  const label = creditActionLabel(feature);

  return (
    <tr aria-label={label} className="border-t border-line align-top">
      <td className="px-3 py-3 text-ink">{label}</td>
      <td className="w-44 px-3 py-3">
        <Input
          aria-label={`${t('costs.col.cost')}: ${label}`}
          inputMode="numeric"
          autoComplete="off"
          value={row.text}
          onChange={(event) => row.setText(event.target.value)}
          error={row.error}
        />
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          size="sm"
          disabled={!row.changed}
          isLoading={row.isSaving}
          aria-label={`${t('costs.save')}: ${label}`}
          onClick={row.save}
        >
          {t('costs.save')}
        </Button>
      </td>
    </tr>
  );
}

export function CostsCard() {
  const { costs, isLoading, error, retry } = useCostsCardController();

  return (
    <Card role="region" aria-labelledby="credit-costs" className="space-y-4">
      <header>
        <h2 id="credit-costs" className="font-display text-lg text-ink">
          {t('costs.title')}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{t('costs.description')}</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error ? (
        <ErrorState
          title={t('mgmt.loadError')}
          description={error.message}
          onRetry={retry}
        />
      ) : costs ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">{t('costs.table.caption')}</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('costs.col.action')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('costs.col.cost')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">{t('costs.col.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_FEATURES.map((feature) => (
                <CostRow
                  key={`${feature}:${String(costs[feature])}`}
                  feature={feature}
                  cost={costs[feature] ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
