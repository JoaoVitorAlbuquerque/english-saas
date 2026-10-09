import type { Cohort } from '@english-saas/api-client';
import { cn } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { buildRetentionMatrix, type RetentionTone } from '../lib/retention';
import { formatFullDay } from '../lib/period';

/** O tom só reforça: o número escrito está sempre na célula. */
const TONE_CLASSES: Record<RetentionTone, string> = {
  high: 'bg-ok/20 text-ink',
  mid: 'bg-chunk-bg text-ink',
  low: 'bg-error/10 text-ink',
  none: 'text-muted',
};

export function RetentionTable({ cohorts }: { cohorts: readonly Cohort[] }) {
  const matrix = buildRetentionMatrix(cohorts);

  return (
    <section aria-labelledby="metrics-retention" className="space-y-2">
      <div>
        <h3 id="metrics-retention" className="font-display text-lg text-ink">
          {t('metrics.retention.title')}
        </h3>
        <p className="text-sm text-muted">
          {t('metrics.retention.description')}
        </p>
      </div>

      {matrix.rows.length === 0 ? (
        <p className="text-sm text-muted">{t('metrics.retention.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[32rem] text-center text-sm">
            <caption className="sr-only">
              {t('metrics.retention.caption')}
            </caption>
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t('metrics.retention.cohort')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('metrics.retention.size')}
                </th>
                {matrix.columns.map((offset) => (
                  <th
                    key={offset}
                    scope="col"
                    className="px-3 py-2 font-medium"
                  >
                    {t('metrics.retention.week', { n: offset })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.cohortWeek} className="border-t border-line">
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-medium text-ink"
                  >
                    {formatFullDay(row.cohortWeek)}
                  </th>
                  <td className="px-3 py-2 font-mono">{row.size}</td>
                  {row.cells.map((cell, index) =>
                    cell === null ? (
                      <td key={index} className="px-3 py-2 text-muted">
                        <span aria-hidden="true">·</span>
                        <span className="sr-only">—</span>
                      </td>
                    ) : (
                      <td
                        key={index}
                        title={t('metrics.retention.cell', {
                          retained: cell.retained,
                          size: row.size,
                        })}
                        className={cn(
                          'px-3 py-2 font-mono',
                          TONE_CLASSES[cell.tone],
                        )}
                      >
                        {cell.label}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
