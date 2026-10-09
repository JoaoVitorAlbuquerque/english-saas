import type { AdminMetrics } from '@english-saas/api-client';
import { LESSON_STEP_TYPE_LABELS } from '@english-saas/shared';
import { BarChart, Card, LineChart } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { Stat } from '../components/Stat';
import { valueScale } from '../lib/chart-scale';
import { formatInt, formatPercent } from '../lib/labels';
import { formatDay } from '../lib/period';
import { RetentionTable } from './RetentionTable';

const STEP_LABELS: Record<string, string> = LESSON_STEP_TYPE_LABELS;

export function EngagementTab({ metrics }: { metrics: AdminMetrics }) {
  const { activity, lessons, retention } = metrics;
  const daily = activity.daily;
  const peak = Math.max(0, ...daily.map((row) => row.mau));
  const lessonPeak = Math.max(
    0,
    ...daily.flatMap((row) => [row.lessonsStarted, row.lessonsCompleted]),
  );
  const dropoffs = lessons.abandonmentByStep;
  const dropoffPeak = Math.max(0, ...dropoffs.map((step) => step.count));

  return (
    <div className="space-y-8">
      <section aria-label={t('metrics.tab.engagement')}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <li>
            <Stat
              label={t('metrics.engagement.dau')}
              value={formatInt(activity.dau)}
            />
          </li>
          <li>
            <Stat
              label={t('metrics.engagement.wau')}
              value={formatInt(activity.wau)}
            />
          </li>
          <li>
            <Stat
              label={t('metrics.engagement.mau')}
              value={formatInt(activity.mau)}
            />
          </li>
          <li>
            <Stat
              label={t('metrics.engagement.completed')}
              value={formatInt(lessons.completed)}
              hint={`${t('metrics.engagement.started')}: ${formatInt(lessons.started)}`}
            />
          </li>
          <li>
            <Stat
              label={t('metrics.engagement.completionRate')}
              value={formatPercent(lessons.completionRate)}
            />
          </li>
          <li>
            <Stat
              label={t('metrics.engagement.abandoned')}
              value={formatInt(lessons.abandoned)}
            />
          </li>
        </ul>
      </section>

      {daily.length === 0 ? (
        <p className="text-sm text-muted">{t('metrics.engagement.empty')}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <LineChart
              title={t('metrics.engagement.activeTitle')}
              description={t('metrics.engagement.activeDescription')}
              series={[
                {
                  id: 'dau',
                  label: t('metrics.engagement.series.dau'),
                  tone: 'accent',
                  points: daily.map((row) => ({
                    x: formatDay(row.date),
                    y: row.dau,
                  })),
                },
                {
                  id: 'wau',
                  label: t('metrics.engagement.series.wau'),
                  tone: 'chunk',
                  points: daily.map((row) => ({
                    x: formatDay(row.date),
                    y: row.wau,
                  })),
                },
                {
                  id: 'mau',
                  label: t('metrics.engagement.series.mau'),
                  tone: 'ok',
                  points: daily.map((row) => ({
                    x: formatDay(row.date),
                    y: row.mau,
                  })),
                },
              ]}
              scale={valueScale(peak, formatInt)}
              formatY={formatInt}
              rowHeader={t('metrics.engagement.activeRowHeader')}
            />
          </Card>

          <Card>
            <LineChart
              title={t('metrics.engagement.lessonsTitle')}
              description={t('metrics.engagement.lessonsDescription')}
              series={[
                {
                  id: 'started',
                  label: t('metrics.engagement.series.started'),
                  tone: 'chunk',
                  points: daily.map((row) => ({
                    x: formatDay(row.date),
                    y: row.lessonsStarted,
                  })),
                },
                {
                  id: 'completed',
                  label: t('metrics.engagement.series.completed'),
                  tone: 'ok',
                  points: daily.map((row) => ({
                    x: formatDay(row.date),
                    y: row.lessonsCompleted,
                  })),
                },
              ]}
              scale={valueScale(lessonPeak, formatInt)}
              formatY={formatInt}
              rowHeader={t('metrics.engagement.activeRowHeader')}
            />
          </Card>
        </div>
      )}

      <RetentionTable cohorts={retention} />

      <section aria-labelledby="metrics-dropoff">
        <Card className="space-y-3">
          <h3 id="metrics-dropoff" className="sr-only">
            {t('metrics.dropoff.title')}
          </h3>
          {dropoffs.length === 0 ? (
            <>
              <p className="font-display text-lg text-ink">
                {t('metrics.dropoff.title')}
              </p>
              <p className="text-sm text-muted">{t('metrics.dropoff.empty')}</p>
            </>
          ) : (
            <BarChart
              title={t('metrics.dropoff.title')}
              description={t('metrics.dropoff.description')}
              items={dropoffs.map((step) => ({
                id: `step-${String(step.stepIndex)}`,
                label: t('metrics.dropoff.step', {
                  n: step.stepIndex + 1,
                  type:
                    step.stepType === null
                      ? t('metrics.dropoff.unknownType')
                      : (STEP_LABELS[step.stepType] ?? step.stepType),
                }),
                value: step.count,
                valueLabel: formatInt(step.count),
              }))}
              scale={valueScale(dropoffPeak, formatInt)}
              rowHeader={t('metrics.dropoff.rowHeader')}
              valueHeader={t('metrics.dropoff.valueHeader')}
            />
          )}
        </Card>
      </section>
    </div>
  );
}
