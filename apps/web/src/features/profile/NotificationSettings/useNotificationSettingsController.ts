import {
  ApiError,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationTypes,
  type UpdatePreferencesRequest,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { HOURS, formatHour, isQuietHour } from '../lib/hours';

const AUTO_HOUR = 'auto';

export function useNotificationSettingsController() {
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [hourError, setHourError] = useState<string | undefined>(undefined);

  const data = preferences.data;

  /** Salva um pedaço; o servidor é quem confirma, a tela já mostra o novo. */
  async function save(patch: UpdatePreferencesRequest): Promise<void> {
    setHourError(undefined);

    try {
      await update.mutateAsync(patch);
      toast.success({ title: t('profile.notifications.saved') });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'REMINDER_HOUR_IN_QUIET_TIME'
      ) {
        setHourError(t('profile.notifications.hourInQuiet'));
        return;
      }

      toast.error({ title: t('profile.notifications.saveError') });
    }
  }

  function setType(type: keyof NotificationTypes, enabled: boolean) {
    void save({ types: { [type]: enabled } });
  }

  function setEmail(enabled: boolean) {
    void save({ channels: { email: enabled } });
  }

  function setReminderHour(value: string) {
    if (data === undefined) {
      return;
    }

    const hour = value === AUTO_HOUR ? null : Number(value);

    // Avisa antes do request; a API continua sendo quem recusa de verdade.
    if (
      hour !== null &&
      isQuietHour(hour, data.quietHours.start, data.quietHours.end)
    ) {
      setHourError(t('profile.notifications.hourInQuiet'));
      return;
    }

    void save({ reminderHour: hour });
  }

  function setQuietHours(next: { start: number; end: number }) {
    if (data === undefined) {
      return;
    }

    const chosen = data.reminderHour;

    if (chosen !== null && isQuietHour(chosen, next.start, next.end)) {
      setHourError(
        t('profile.notifications.quietCoversReminder', {
          hour: formatHour(chosen),
        }),
      );
      return;
    }

    void save({ quietHours: next });
  }

  return {
    isLoading: preferences.isLoading,
    isError: preferences.isError,
    retry: () => void preferences.refetch(),
    preferences: data,
    isAllOff: data !== undefined && !data.channels.email && !data.channels.push,
    setType,
    setEmail,
    reminderHourValue:
      data?.reminderHour === null || data === undefined
        ? AUTO_HOUR
        : String(data.reminderHour),
    reminderHourOptions: [
      {
        value: AUTO_HOUR,
        label: t('profile.notifications.followStudyTime', {
          hour: formatHour(data?.effectiveReminderHour ?? 19),
        }),
      },
      ...HOURS.map((hour) => ({
        value: String(hour),
        label: formatHour(hour),
      })),
    ],
    quietHourOptions: HOURS.map((hour) => ({
      value: String(hour),
      label: formatHour(hour),
    })),
    setReminderHour,
    setQuietHours,
    hourError,
  };
}
