import { Card, GroupedBarChart } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import type { ProgressView } from './useProgressController';

export function PlanSection({
  plan,
  stats,
}: Pick<ProgressView, 'plan' | 'stats'>) {
  const days = (count: number) =>
    t(count === 1 ? 'progress.stats.day' : 'progress.stats.days', { count });

  const numbers = [
    {
      label: t('progress.stats.minutes'),
      value: t('progress.plan.minutes', { count: stats.minutesStudied }),
    },
    {
      label: t('progress.stats.lessons'),
      value: String(stats.lessonsCompleted),
    },
    { label: t('progress.stats.reviews'), value: String(stats.reviewsDone) },
    { label: t('progress.stats.streak'), value: days(stats.currentStreak) },
    {
      label: t('progress.stats.longestStreak'),
      value: days(stats.longestStreak),
    },
  ];

  return (
    <section aria-labelledby="progress-plan" className="flex flex-col gap-4">
      <h2 id="progress-plan" className="sr-only">
        {t('progress.plan.title')}
      </h2>

      <Card>
        <GroupedBarChart
          title={t('progress.plan.title')}
          description={t('progress.plan.description')}
          rowHeader={t('progress.plan.rowHeader')}
          emptyLabel={t('progress.plan.empty')}
          formatValue={(value) => t('progress.plan.minutes', { count: value })}
          series={[
            {
              id: 'planned',
              label: t('progress.plan.planned'),
              tone: 'muted',
              hatched: true,
            },
            { id: 'done', label: t('progress.plan.done'), tone: 'accent' },
          ]}
          categories={plan.weeks.map((week) => ({
            id: week.id,
            label: week.label,
            values: { planned: week.planned, done: week.done },
          }))}
        />
      </Card>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {numbers.map((entry) => (
          <Card key={entry.label} className="flex flex-col gap-1 p-4">
            <dt className="text-xs text-muted">{entry.label}</dt>
            <dd className="font-display text-xl text-ink">{entry.value}</dd>
          </Card>
        ))}
      </dl>
    </section>
  );
}
