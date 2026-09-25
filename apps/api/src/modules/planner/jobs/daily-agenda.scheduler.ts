import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';

import { DAILY_TICK_JOB } from './planner-jobs';

/** 00:30 no fuso do aluno — `cron-parser` (via BullMQ) já lida com horário de verão. */
const DAILY_TICK_PATTERN = '30 0 * * *';

/**
 * Um job repetível por fuso horário, não por aluno.
 *
 * Registra um na subida para cada fuso distinto em uso; o `PlannerListener`
 * chama `ensureTimezoneJob` de novo sempre que um aluno aparece com um fuso
 * ainda não visto (onboarding, edição de perfil) — sem isso, um fuso novo só
 * ganhava o cron no próximo restart da API.
 */
@Injectable()
export class DailyAgendaScheduler implements OnModuleInit {
  private readonly logger = new Logger(DailyAgendaScheduler.name);

  constructor(
    @InjectQueue(QUEUES.PLANNER) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.envService.isTest) {
      return;
    }

    const rows = await this.prisma.studentProfile.findMany({
      distinct: ['timezone'],
      select: { timezone: true },
    });

    await Promise.all(rows.map((row) => this.ensureTimezoneJob(row.timezone)));

    this.logger.log(
      { timezones: rows.length },
      'Agenda diária agendada por fuso horário',
    );
  }

  async ensureTimezoneJob(timezone: string): Promise<void> {
    await this.queue.add(
      DAILY_TICK_JOB,
      { timezone },
      {
        repeat: { pattern: DAILY_TICK_PATTERN, tz: timezone },
        jobId: `${DAILY_TICK_JOB}-${timezone}`,
      },
    );
  }
}
