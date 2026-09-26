import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import { ReminderService } from '../services/reminder.service';
import {
  REMINDER_JOB,
  TIMEZONE_TICK_JOB,
  WEEKLY_SUMMARY_JOB,
  type TimezoneTickJobData,
  type UserNotificationJobData,
} from './notification-jobs';

@Processor(QUEUES.NOTIFICATIONS, defaultWorkerOptions())
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly reminders: ReminderService) {
    super();
  }

  async process(
    job: Job<TimezoneTickJobData | UserNotificationJobData>,
  ): Promise<unknown> {
    switch (job.name) {
      case TIMEZONE_TICK_JOB:
        // O repetível dispara na hora cheia; o relógio é o do processamento.
        return this.reminders.tick(job.data.timezone);
      case REMINDER_JOB:
        return this.reminders.sendReminder(job.data as UserNotificationJobData);
      case WEEKLY_SUMMARY_JOB:
        return this.reminders.sendWeeklySummary(
          job.data as UserNotificationJobData,
        );
      default:
        return { skipped: true };
    }
  }
}
