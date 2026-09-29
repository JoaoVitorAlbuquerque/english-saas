import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { LearningActivityService } from 'src/modules/learning/services/learning-activity.service';
import { AgendaService } from 'src/modules/planner/services/agenda.service';
import {
  addDays,
  daysBetween,
  localDayBounds,
  weekStart,
} from 'src/modules/progress/domain/dates';
import { StudentProgressService } from 'src/modules/progress/services/student-progress.service';
import { ReviewCardService } from 'src/modules/srs/services/review-card.service';
import { ReviewLogService } from 'src/modules/srs/services/review-log.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  dailyReminderMessage,
  reviewBacklogMessage,
  weeklySummaryMessage,
  type PendingBlock,
} from '../domain/messages';
import {
  chooseReminder,
  reminderDedupKey,
  weeklyDedupKey,
  type ReminderDecision,
} from '../domain/rules';
import {
  isQuietHour,
  localClock,
  reminderHourFor,
  WEEKLY_SUMMARY_WEEKDAY,
} from '../domain/schedule';
import {
  REMINDER_JOB,
  WEEKLY_SUMMARY_JOB,
  type UserNotificationJobData,
} from '../jobs/notification-jobs';
import type { DeliveryOutcome } from './notification-sender.service';
import { NotificationSenderService } from './notification-sender.service';
import { PreferenceService } from './preference.service';

const USER_BATCH = 500;

/**
 * Lembretes em cima do planner. Um tick por fuso a cada hora cheia: pega
 * quem daquele fuso tem o lembrete nesta hora e enfileira um job por aluno
 * (jobId com a data — o mesmo aluno não entra duas vezes no mesmo dia). O
 * job por aluno lê o estado do dia e decide com `chooseReminder`.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly preferences: PreferenceService,
    private readonly sender: NotificationSenderService,
    private readonly learning: LearningActivityService,
    private readonly reviewLogs: ReviewLogService,
    private readonly reviewCards: ReviewCardService,
    private readonly agenda: AgendaService,
    private readonly progress: StudentProgressService,
  ) {}

  /** O tick de um fuso. Devolve quantos jobs enfileirou, por tipo. */
  async tick(
    timezone: string,
    now = new Date(),
  ): Promise<{ reminders: number; weekly: number }> {
    const clock = localClock(now, timezone);
    const counts = { reminders: 0, weekly: 0 };
    let afterId: string | undefined;

    for (;;) {
      const page = await this.users.remindableInTimezone({
        timezone,
        afterId,
        take: USER_BATCH,
      });
      if (page.length === 0) break;

      const prefs = await this.preferences.many(page.map((u) => u.userId));

      for (const user of page) {
        const pref = prefs.get(user.userId);
        if (pref === undefined) continue;
        if (
          reminderHourFor(pref.reminderHour, user.preferredStudyTime) !==
          clock.hour
        ) {
          continue;
        }

        const data: UserNotificationJobData = {
          userId: user.userId,
          timezone,
          localDate: clock.date,
          at: now.toISOString(),
        };

        if (pref.dailyReminder || pref.reviewBacklog) {
          await this.queue.add(REMINDER_JOB, data, {
            jobId: `reminder-${user.userId}-${clock.date}`,
          });
          counts.reminders += 1;
        }

        if (clock.weekday === WEEKLY_SUMMARY_WEEKDAY && pref.weeklySummary) {
          await this.queue.add(WEEKLY_SUMMARY_JOB, data, {
            jobId: `weekly-${user.userId}-${clock.date}`,
          });
          counts.weekly += 1;
        }
      }

      afterId = page.at(-1)?.userId;
      if (page.length < USER_BATCH) break;
    }

    return counts;
  }

  /** O lembrete do dia de um aluno: diário ou de revisões acumuladas. */
  async sendReminder(
    data: UserNotificationJobData,
  ): Promise<{ decision: ReminderDecision; outcome: DeliveryOutcome | null }> {
    const now = new Date(data.at);
    const [user, prefs] = await Promise.all([
      this.users.findById(data.userId),
      this.preferences.get(data.userId),
    ]);
    const clock = localClock(now, data.timezone);
    const dedupKey = reminderDedupKey(data.userId, data.localDate);

    const [channels, already, studiedToday, lastBacklog, due] =
      await Promise.all([
        this.sender.enabledChannels(prefs),
        this.prisma.notificationLog.findUnique({ where: { dedupKey } }),
        this.studiedToday(data.userId, data.localDate, data.timezone, now),
        this.prisma.notificationLog.findFirst({
          where: { userId: data.userId, type: 'REVIEW_BACKLOG' },
          orderBy: { createdAt: 'desc' },
        }),
        this.reviewCards.dueFor(data.userId, now),
      ]);

    // A agenda só é lida (e gerada) quando pode virar mensagem.
    const pending =
      already === null && !studiedToday
        ? await this.pendingBlocks(data.userId, now)
        : [];

    const decision = chooseReminder({
      prefs,
      hasChannel: channels.length > 0,
      quiet: isQuietHour(clock.hour, prefs.quietStart, prefs.quietEnd),
      alreadyRemindedToday: already !== null,
      studiedToday,
      pendingMinutes: pending.reduce((sum, b) => sum + b.estimatedMinutes, 0),
      dueCards: due.length,
      daysSinceLastBacklog:
        lastBacklog === null
          ? null
          : daysBetween(lastBacklog.localDate, data.localDate),
    });

    if (!decision.send) {
      return { decision, outcome: null };
    }

    const content =
      decision.type === 'REVIEW_BACKLOG'
        ? reviewBacklogMessage(due.length)
        : dailyReminderMessage(pending);

    const outcome = await this.sender.deliver({
      recipient: { userId: user.id, email: user.email, name: user.name },
      channels,
      dedupKey,
      localDate: data.localDate,
      notification: { ...content, type: decision.type },
    });

    return { decision, outcome };
  }

  /**
   * Resumo da semana anterior, só por e-mail. Não conta no limite de
   * lembretes: é outro tipo, com chave própria por semana.
   */
  async sendWeeklySummary(
    data: UserNotificationJobData,
  ): Promise<DeliveryOutcome | 'SKIPPED'> {
    const now = new Date(data.at);
    const [user, prefs] = await Promise.all([
      this.users.findById(data.userId),
      this.preferences.get(data.userId),
    ]);
    const clock = localClock(now, data.timezone);

    if (
      !prefs.weeklySummary ||
      isQuietHour(clock.hour, prefs.quietStart, prefs.quietEnd)
    ) {
      return 'SKIPPED';
    }

    const lastWeek = addDays(weekStart(data.localDate), -7);
    const [channels, numbers] = await Promise.all([
      this.sender.enabledChannels(prefs, ['EMAIL']),
      this.progress.weekSummary(data.userId, lastWeek),
    ]);

    return this.sender.deliver({
      recipient: { userId: user.id, email: user.email, name: user.name },
      channels,
      dedupKey: weeklyDedupKey(data.userId, lastWeek),
      localDate: data.localDate,
      notification: {
        ...weeklySummaryMessage(numbers),
        type: 'WEEKLY_SUMMARY',
      },
    });
  }

  /** Estudou hoje (no fuso dele): etapa, resposta, lição aberta ou revisão. */
  private async studiedToday(
    userId: string,
    localDate: string,
    timezone: string,
    now: Date,
  ): Promise<boolean> {
    const { start } = localDayBounds(localDate, timezone);
    const end = new Date(now.getTime() + 1);
    const [[activity], reviews] = await Promise.all([
      this.learning.activityByUser([userId], start, end),
      this.reviewLogs.countsByUser([userId], start, end),
    ]);

    return (
      (activity !== undefined &&
        (activity.answers > 0 ||
          activity.stepTimeMs > 0 ||
          activity.lessonsStarted > 0)) ||
      (reviews[0]?.reviews ?? 0) > 0
    );
  }

  private async pendingBlocks(
    userId: string,
    now: Date,
  ): Promise<PendingBlock[]> {
    try {
      const agenda = await this.agenda.today(userId, now);
      return agenda.blocks
        .filter((block) => block.status === 'PENDING')
        .map((block) => ({
          type: block.type,
          estimatedMinutes: block.estimatedMinutes,
          title: block.title,
          count: block.count,
        }));
    } catch (error) {
      this.logger.warn(
        { userId, error: error instanceof Error ? error.message : 'unknown' },
        'Agenda indisponível para o lembrete',
      );
      return [];
    }
  }
}
