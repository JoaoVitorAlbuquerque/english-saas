import { Injectable } from '@nestjs/common';
import type { NotificationPreference } from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  isQuietHour,
  reminderHourFor,
  type PreferredStudyTime,
} from '../domain/schedule';
import type { UnsubscribableType } from '../domain/unsubscribe';
import type { UpdatePreferencesDto } from '../dto/notifications.dto';
import { ReminderHourInQuietTimeError } from '../notifications.errors';
import { WebPushSender } from './web-push-sender';

const TYPE_FIELDS: Record<
  UnsubscribableType,
  'dailyReminder' | 'reviewBacklog' | 'weeklySummary'
> = {
  DAILY_REMINDER: 'dailyReminder',
  REVIEW_BACKLOG: 'reviewBacklog',
  WEEKLY_SUMMARY: 'weeklySummary',
};

/** Perfil → Notificações. A linha nasce com os padrões na primeira leitura. */
@Injectable()
export class PreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly push: WebPushSender,
  ) {}

  async get(userId: string): Promise<NotificationPreference> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  /** Preferências de vários alunos; quem não tem linha recebe os padrões. */
  async many(
    userIds: readonly string[],
  ): Promise<Map<string, NotificationPreference>> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: [...userIds] } },
    });
    const byUser = new Map(rows.map((row) => [row.userId, row]));

    return new Map(
      userIds.map((userId) => [
        userId,
        byUser.get(userId) ?? defaultPreference(userId),
      ]),
    );
  }

  async view(userId: string) {
    const [prefs, preferred, devices] = await Promise.all([
      this.get(userId),
      this.preferredStudyTime(userId),
      this.prisma.pushSubscription.count({ where: { userId } }),
    ]);

    return {
      types: {
        dailyReminder: prefs.dailyReminder,
        reviewBacklog: prefs.reviewBacklog,
        weeklySummary: prefs.weeklySummary,
      },
      channels: {
        email: prefs.emailEnabled,
        push: prefs.pushEnabled,
      },
      reminderHour: prefs.reminderHour,
      /** A hora que vale de fato: a escolhida, ou a do horário preferido. */
      effectiveReminderHour: reminderHourFor(prefs.reminderHour, preferred),
      quietHours: { start: prefs.quietStart, end: prefs.quietEnd },
      push: {
        available: this.push.publicKey() !== null,
        devices,
      },
    };
  }

  async update(userId: string, patch: UpdatePreferencesDto) {
    const current = await this.get(userId);
    const next = {
      dailyReminder: patch.types?.dailyReminder ?? current.dailyReminder,
      reviewBacklog: patch.types?.reviewBacklog ?? current.reviewBacklog,
      weeklySummary: patch.types?.weeklySummary ?? current.weeklySummary,
      emailEnabled: patch.channels?.email ?? current.emailEnabled,
      pushEnabled: patch.channels?.push ?? current.pushEnabled,
      reminderHour:
        patch.reminderHour === undefined
          ? current.reminderHour
          : patch.reminderHour,
      quietStart: patch.quietHours?.start ?? current.quietStart,
      quietEnd: patch.quietHours?.end ?? current.quietEnd,
    };

    // Só a hora escolhida explicitamente é conferida: a que sai do horário
    // preferido pode cair no silencioso, e aí o aluno optou por silêncio.
    if (
      next.reminderHour !== null &&
      isQuietHour(next.reminderHour, next.quietStart, next.quietEnd)
    ) {
      throw new ReminderHourInQuietTimeError();
    }

    await this.prisma.notificationPreference.update({
      where: { userId },
      data: next,
    });

    return this.view(userId);
  }

  /** O link "parar de receber" do e-mail desliga só aquele tipo. */
  async disableType(userId: string, type: UnsubscribableType): Promise<void> {
    await this.get(userId);
    await this.prisma.notificationPreference.update({
      where: { userId },
      data: { [TYPE_FIELDS[type]]: false },
    });
  }

  async setPushEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.get(userId);
    await this.prisma.notificationPreference.update({
      where: { userId },
      data: { pushEnabled: enabled },
    });
  }

  private async preferredStudyTime(
    userId: string,
  ): Promise<PreferredStudyTime> {
    try {
      return (await this.users.getProfile(userId)).preferredStudyTime;
    } catch {
      // Sem perfil (onboarding não feito): o horário "qualquer".
      return 'ANY';
    }
  }
}

export function defaultPreference(userId: string): NotificationPreference {
  const now = new Date(0);
  return {
    id: '',
    userId,
    dailyReminder: true,
    reviewBacklog: true,
    weeklySummary: true,
    emailEnabled: true,
    pushEnabled: false,
    reminderHour: null,
    quietStart: 22,
    quietEnd: 8,
    createdAt: now,
    updatedAt: now,
  };
}
