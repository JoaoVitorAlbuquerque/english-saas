import type { AdminMetrics } from '@english-saas/api-client';
import { BarChart, Card, GroupedBarChart } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t, type MessageKey } from '../../../messages/pt-BR';
import { formatUsdMicros } from '../../studio/lib/format-usd';
import { Stat } from '../components/Stat';
import { valueScale } from '../lib/chart-scale';
import { aiFeatureLabel, formatInt } from '../lib/labels';
import { formatBrlCents } from '../lib/money';
import { tierLabel } from '../lib/plan-name';

function tierName(tier: string): string {
  return tier === 'SYSTEM'
    ? t('metrics.costs.tier.SYSTEM')
    : (tierLabel(tier) ?? tier);
}

export function CostsTab({ metrics }: { metrics: AdminMetrics }) {
  const { aiCost, revenue } = metrics;
  const featurePeak = Math.max(
    0,
    ...aiCost.byFeature.map((r) => r.costUsdMicros),
  );
  const tierPeak = Math.max(0, ...aiCost.byTier.map((r) => r.costUsdMicros));
  const usdScale = (peak: number) => valueScale(peak, formatUsdMicros);

  return (
    <div className="space-y-8">
      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Stat
            label={t('metrics.costs.total')}
            value={formatUsdMicros(aiCost.totalUsdMicros)}
            hint={t('metrics.costs.rate', {
              rate: String(revenue.usdBrlRate).replace('.', ','),
            })}
          />
        </li>
      </ul>

      {aiCost.byFeature.length === 0 ? (
        <p className="text-sm text-muted">{t('metrics.costs.empty')}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <BarChart
              title={t('metrics.costs.byFeatureTitle')}
              description={t('metrics.costs.byFeatureDescription')}
              tone="chunk"
              items={aiCost.byFeature.map((row) => ({
                id: row.feature,
                label: aiFeatureLabel(row.feature),
                value: row.costUsdMicros,
                valueLabel: formatUsdMicros(row.costUsdMicros),
                note: t('metrics.costs.calls', {
                  calls: formatInt(row.calls),
                  brl: formatBrlCents(row.costBrlCents).replace('R$ ', ''),
                }),
              }))}
              scale={usdScale(featurePeak)}
              rowHeader={t('metrics.costs.rowFeature')}
              valueHeader={t('metrics.costs.valueHeader')}
            />
          </Card>
          <Card>
            <BarChart
              title={t('metrics.costs.byTierTitle')}
              description={t('metrics.costs.byTierDescription')}
              tone="accent"
              items={aiCost.byTier.map((row) => ({
                id: row.tier,
                label: tierName(row.tier),
                value: row.costUsdMicros,
                valueLabel: formatUsdMicros(row.costUsdMicros),
                note: t('metrics.costs.calls', {
                  calls: formatInt(row.calls),
                  brl: formatBrlCents(row.costBrlCents).replace('R$ ', ''),
                }),
              }))}
              scale={usdScale(tierPeak)}
              rowHeader={t('metrics.costs.rowTier')}
              valueHeader={t('metrics.costs.valueHeader')}
            />
          </Card>
        </div>
      )}

      <Card className="space-y-4">
        <GroupedBarChart
          title={t('metrics.costs.revenueTitle')}
          description={t('metrics.costs.revenueDescription')}
          series={[
            {
              id: 'revenue',
              label: t('metrics.costs.series.revenue'),
              tone: 'ok',
            },
            {
              id: 'cost',
              label: t('metrics.costs.series.cost'),
              tone: 'chunk',
              hatched: true,
            },
          ]}
          categories={revenue.byTier.map((row) => ({
            id: row.tier,
            label: tierName(row.tier),
            values: {
              revenue: row.revenueCents,
              cost: row.aiCostBrlCents,
            },
          }))}
          formatValue={formatBrlCents}
          rowHeader={t('metrics.costs.revenueRowHeader')}
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">
              {t('metrics.costs.revenueCaption')}
            </caption>
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('metrics.costs.col.tier')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('metrics.costs.col.subscribers')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('metrics.costs.col.activeUsers')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('metrics.costs.col.mrr')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('metrics.costs.col.revenue')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('metrics.costs.col.cost')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('metrics.costs.col.margin')}
                </th>
              </tr>
            </thead>
            <tbody>
              {revenue.byTier.map((row) => (
                <tr key={row.tier} className="border-t border-line">
                  <th
                    scope="row"
                    className="py-2 pr-3 text-left font-medium text-ink"
                  >
                    {tierName(row.tier)}
                  </th>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatInt(row.subscribers)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatInt(row.activeUsers)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatBrlCents(row.mrrCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatBrlCents(row.revenueCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatBrlCents(row.aiCostBrlCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatBrlCents(row.marginCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card role="region" aria-labelledby="metrics-top" className="space-y-3">
        <div>
          <h3 id="metrics-top" className="font-display text-lg text-ink">
            {t('metrics.costs.topTitle')}
          </h3>
          <p className="text-sm text-muted">
            {t('metrics.costs.topDescription')}
          </p>
        </div>

        {aiCost.topUsers.length === 0 ? (
          <p className="text-sm text-muted">{t('metrics.costs.topEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">
                {t('metrics.costs.topCaption')}
              </caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t('metrics.costs.col.student')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.costs.col.calls')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.costs.col.usd')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.costs.col.brl')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="sr-only">
                      {t('metrics.costs.openStudent' as MessageKey)}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {aiCost.topUsers.map((row, index) => {
                  const name = row.email ?? t('metrics.costs.noEmail');

                  return (
                    <tr
                      key={row.userId}
                      aria-label={`${String(index + 1)}. ${name}`}
                      className="border-t border-line"
                    >
                      <td className="py-2 pr-3 break-all text-ink">
                        <span className="mr-2 text-xs text-muted">
                          {index + 1}.
                        </span>
                        {name}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatInt(row.calls)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatUsdMicros(row.costUsdMicros)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatBrlCents(row.costBrlCents)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={`/alunos/${row.userId}`}
                          aria-label={`${t('metrics.costs.openStudent')}: ${name}`}
                          className="text-accent underline"
                        >
                          {t('metrics.costs.openStudent')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
