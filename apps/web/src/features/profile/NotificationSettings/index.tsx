import { Card, Checkbox, ErrorState, Select, Skeleton } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { BackToProfile } from '../components/BackToProfile';
import { useNotificationSettingsController } from './useNotificationSettingsController';
import { PushSection } from './PushSection';

export function NotificationSettings() {
  const {
    isLoading,
    isError,
    retry,
    preferences,
    isAllOff,
    setType,
    setEmail,
    reminderHourValue,
    reminderHourOptions,
    quietHourOptions,
    setReminderHour,
    setQuietHours,
    hourError,
  } = useNotificationSettingsController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError || preferences === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <BackToProfile />
        <ErrorState
          title={t('profile.notifications.errorTitle')}
          onRetry={retry}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToProfile />
      <div>
        <h1 className="font-display text-xl text-ink">
          {t('profile.notifications.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('profile.notifications.description')}
        </p>
      </div>

      <Card className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-ink">
          {t('profile.notifications.channelsTitle')}
        </h2>
        <Checkbox
          label={t('profile.notifications.channelEmail')}
          checked={preferences.channels.email}
          onCheckedChange={setEmail}
        />
        {isAllOff ? (
          <p role="status" className="text-sm text-muted">
            {t('profile.notifications.allOff')}
          </p>
        ) : null}
      </Card>

      <PushSection preferences={preferences} />

      <Card className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-ink">
          {t('profile.notifications.typesTitle')}
        </h2>
        <TypeToggle
          label={t('profile.notifications.typeDaily')}
          hint={t('profile.notifications.typeDailyHint')}
          checked={preferences.types.dailyReminder}
          onChange={(checked) => setType('dailyReminder', checked)}
        />
        <TypeToggle
          label={t('profile.notifications.typeReview')}
          hint={t('profile.notifications.typeReviewHint')}
          checked={preferences.types.reviewBacklog}
          onChange={(checked) => setType('reviewBacklog', checked)}
        />
        <TypeToggle
          label={t('profile.notifications.typeWeekly')}
          hint={t('profile.notifications.typeWeeklyHint')}
          checked={preferences.types.weeklySummary}
          onChange={(checked) => setType('weeklySummary', checked)}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-ink">
          {t('profile.notifications.timeTitle')}
        </h2>
        <Select
          label={t('profile.notifications.reminderHour')}
          value={reminderHourValue}
          options={reminderHourOptions}
          error={hourError}
          onChange={(event) => setReminderHour(event.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-ink">
            {t('profile.notifications.quietTitle')}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t('profile.notifications.quietDescription')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('profile.notifications.quietStart')}
            value={String(preferences.quietHours.start)}
            options={quietHourOptions}
            onChange={(event) =>
              setQuietHours({
                start: Number(event.target.value),
                end: preferences.quietHours.end,
              })
            }
          />
          <Select
            label={t('profile.notifications.quietEnd')}
            value={String(preferences.quietHours.end)}
            options={quietHourOptions}
            onChange={(event) =>
              setQuietHours({
                start: preferences.quietHours.start,
                end: Number(event.target.value),
              })
            }
          />
        </div>
      </Card>
    </div>
  );
}

function TypeToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div>
      <Checkbox label={label} checked={checked} onCheckedChange={onChange} />
      <p className="-mt-2 pl-[30px] text-sm text-muted">{hint}</p>
    </div>
  );
}
