import type { AdminStudentOverview } from '@english-saas/api-client';
import {
  LEARNING_GOAL_LABELS,
  PREFERRED_STUDY_TIME_LABELS,
  ROLE_LABELS,
  SELF_REPORTED_LEVEL_LABELS,
  WEEKDAY_LABELS,
  WEEKDAYS,
} from '@english-saas/shared';
import { Badge, Card, type BadgeTone } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import {
  formatDate,
  studentStatus,
  type StudentStatus,
} from '../../lib/labels';
import { formatFullDay } from '../../lib/period';

const STATUS_TONES: Record<StudentStatus, BadgeTone> = {
  ACTIVE: 'ok',
  DELETED: 'error',
  ANONYMIZED: 'muted',
};

export function ProfileHeader({
  overview,
}: {
  overview: AdminStudentOverview;
}) {
  const { user, profile, interests } = overview;
  const status = studentStatus(user);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{user.name}</h1>
          <p className="break-all text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={user.role === 'STUDENT' ? 'muted' : 'accent'}>
            {ROLE_LABELS[user.role]}
          </Badge>
          <Badge tone={STATUS_TONES[status]}>
            {t(`students.status.${status}`)}
          </Badge>
        </div>
      </div>

      {status === 'DELETED' && user.deletedAt !== null ? (
        <p role="note" className="rounded-lg bg-error/5 p-3 text-sm text-ink">
          {t('student.deletedNote', { date: formatDate(user.deletedAt) })}
        </p>
      ) : null}
      {status === 'ANONYMIZED' ? (
        <p role="note" className="rounded-lg bg-line/50 p-3 text-sm text-ink">
          {t('student.anonymizedNote')}
        </p>
      ) : null}

      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <li>{t('student.createdAt', { date: formatDate(user.createdAt) })}</li>
        {profile ? (
          <>
            <li>{t('student.timezone', { timezone: profile.timezone })}</li>
            <li>
              {t('student.declaredLevel', {
                level: SELF_REPORTED_LEVEL_LABELS[profile.selfReportedLevel],
              })}
            </li>
            <li>
              {t('student.studyTime', {
                time: PREFERRED_STUDY_TIME_LABELS[profile.preferredStudyTime],
              })}
            </li>
            {profile.targetDate ? (
              <li>
                {t('student.targetDate', {
                  date: formatFullDay(profile.targetDate.slice(0, 10)),
                })}
              </li>
            ) : null}
          </>
        ) : null}
      </ul>

      {profile ? (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-xs font-medium text-muted">
              {t('student.goals')}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {profile.goals.map((goal) => (
                <li key={goal}>
                  <Badge tone="accent">{LEARNING_GOAL_LABELS[goal]}</Badge>
                </li>
              ))}
            </ul>
            {profile.goalNote ? (
              <p className="mt-2 text-muted">
                {t('student.goalNote', { note: profile.goalNote })}
              </p>
            ) : null}
          </div>
          <div>
            <h2 className="mb-1 text-xs font-medium text-muted">
              {t('student.interests')}
            </h2>
            {interests.length === 0 ? (
              <p className="text-muted">{t('student.noInterests')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <li key={interest.topic}>
                    <Badge tone="muted">{interest.topic}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sm:col-span-2">
            <h2 className="mb-1 text-xs font-medium text-muted">
              {t('student.availability')}
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
              {WEEKDAYS.map((weekday) => (
                <li key={weekday}>
                  {WEEKDAY_LABELS[weekday]}:{' '}
                  {profile.availabilityMinutes[weekday]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">{t('student.noProfile')}</p>
      )}
    </Card>
  );
}
