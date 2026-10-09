import { Badge, GroupedBarChart } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { Section } from '../../components/Section';
import { formatDay, formatFullDay } from '../../lib/period';
import type { StudentProfileView } from '../useStudentProfileController';

/** Quantas lições do caminho aparecem na lista; o resto vira "e mais N". */
const VISIBLE_PATH = 6;

export function PlanSection({
  plan,
  progress,
}: {
  plan: StudentProfileView['plan'];
  progress: StudentProfileView['progress'];
}) {
  const study = plan.data?.plan ?? null;
  const pace = plan.data?.pace ?? null;
  const weeks = progress.data?.plan.weeks ?? [];
  const stats = progress.data?.stats;

  return (
    <Section
      id="student-plan"
      title={t('student.plan.title')}
      isLoading={plan.isLoading}
      error={plan.error}
      onRetry={plan.retry}
    >
      {plan.data && study === null ? (
        <p className="text-sm text-muted">{t('student.plan.none')}</p>
      ) : null}

      {study ? (
        <div className="space-y-5">
          <ul className="space-y-1 text-sm text-ink">
            <li>
              <Badge tone="accent">
                {t('student.plan.target', { level: study.targetLevel })}
              </Badge>
            </li>
            {study.targetDate ? (
              <li>
                {t('student.plan.targetDate', {
                  date: formatFullDay(study.targetDate.slice(0, 10)),
                })}
              </li>
            ) : null}
            {study.forecast?.message ? (
              <li>
                {t('student.plan.forecast', {
                  message: study.forecast.message,
                })}
              </li>
            ) : null}
            <li>
              {pace?.message
                ? t('student.plan.pace', { message: pace.message })
                : t('student.plan.onPace')}
            </li>
            {stats ? (
              <li className="text-muted">
                {t('student.plan.stats', {
                  minutes: stats.minutesStudied,
                  lessons: stats.lessonsCompleted,
                  reviews: stats.reviewsDone,
                  streak: stats.currentStreak,
                })}
              </li>
            ) : null}
          </ul>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">
              {t('student.plan.next')}
            </h3>
            {study.path.length === 0 ? (
              <p className="text-sm text-muted">
                {t('student.plan.nextEmpty')}
              </p>
            ) : (
              <>
                <ol className="space-y-1 text-sm">
                  {study.path.slice(0, VISIBLE_PATH).map((entry) => (
                    <li
                      key={entry.lessonId}
                      className="flex flex-wrap items-baseline gap-2"
                    >
                      <span className="font-medium text-ink">
                        {entry.title}
                      </span>
                      <Badge tone="muted">{entry.cefrLevel}</Badge>
                      <span className="text-muted">
                        {t('student.plan.minutes', {
                          minutes: entry.estimatedMinutes,
                        })}
                      </span>
                    </li>
                  ))}
                </ol>
                {study.path.length > VISIBLE_PATH ? (
                  <p className="mt-1 text-sm text-muted">
                    {t('student.plan.more', {
                      count: study.path.length - VISIBLE_PATH,
                    })}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {study.reinforceSkillIds.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">
                {t('student.plan.reinforce')}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {study.reinforceSkillIds.map((id) => (
                  <li key={id}>
                    <Badge tone="muted" className="font-mono">
                      {id}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {weeks.length > 0 ? (
            <GroupedBarChart
              title={t('student.plan.weeks')}
              description={t('student.plan.weeksDescription')}
              series={[
                {
                  id: 'planned',
                  label: t('student.plan.planned'),
                  tone: 'chunk',
                  hatched: true,
                },
                {
                  id: 'studied',
                  label: t('student.plan.studied'),
                  tone: 'accent',
                },
              ]}
              categories={weeks.map((week) => ({
                id: week.weekStart,
                label: formatDay(week.weekStart),
                values: {
                  planned: week.plannedMinutes,
                  studied: week.studiedMinutes,
                },
              }))}
              formatValue={(value) => `${String(value)} min`}
              rowHeader={t('student.level.week')}
            />
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
