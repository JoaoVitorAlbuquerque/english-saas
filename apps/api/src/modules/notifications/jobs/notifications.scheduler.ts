import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';
import { UsersService } from 'src/modules/users/services/users.service';

import { TIMEZONE_TICK_JOB } from './notification-jobs';

/** Toda hora cheia, no relógio do fuso — o horário de verão é do BullMQ. */
const HOURLY_PATTERN = '0 * * * *';

/**
 * Um job repetível por fuso horário, não por aluno (mesma ideia do
 * `DailyAgendaScheduler` do planner). Fuso novo ganha o seu pelo listener,
 * sem esperar o próximo restart.
 */
@Injectable()
export class NotificationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
    private readonly users: UsersService,
    private readonly envService: EnvService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Em teste o e2e chama o tick direto, com o relógio que quiser.
    if (this.envService.isTest) {
      return;
    }

    const timezones = await this.users.distinctTimezones();
    await Promise.all(timezones.map((tz) => this.ensureTimezoneJob(tz)));

    this.logger.log(
      { timezones: timezones.length },
      'Lembretes agendados por fuso horário',
    );
  }

  async ensureTimezoneJob(timezone: string): Promise<void> {
    if (this.envService.isTest) {
      return;
    }

    await this.queue.add(
      TIMEZONE_TICK_JOB,
      { timezone },
      {
        repeat: { pattern: HOURLY_PATTERN, tz: timezone },
        jobId: `${TIMEZONE_TICK_JOB}-${timezone}`,
      },
    );
  }
}
