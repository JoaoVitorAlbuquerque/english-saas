import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, Queue, type Job } from 'bullmq';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import { AgendaService } from '../services/agenda.service';
import { PlanService } from '../services/plan.service';
import {
  ADD_REINFORCEMENT_JOB,
  DAILY_TICK_JOB,
  REBUILD_JOB,
  REMOVE_FROM_PATH_JOB,
} from './planner-jobs';

type RebuildJobData = { userId: string };
type RemoveFromPathJobData = { userId: string; lessonId: string };
type AddReinforcementJobData = { userId: string; skillIds: string[] };
type DailyTickJobData = { timezone: string };

type PlannerJobData =
  | RebuildJobData
  | RemoveFromPathJobData
  | AddReinforcementJobData
  | DailyTickJobData;

/** Espera quando outro worker está com o mesmo aluno. */
const LOCKED_RETRY_MS = 500;

@Processor(QUEUES.PLANNER, defaultWorkerOptions())
export class PlannerProcessor extends WorkerHost {
  constructor(
    private readonly plans: PlanService,
    private readonly agenda: AgendaService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.PLANNER) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<PlannerJobData>, token?: string): Promise<unknown> {
    if (job.name === REBUILD_JOB) {
      const { userId } = job.data as RebuildJobData;
      const outcome = await this.plans.rebuild(userId);

      if (outcome.status === 'LOCKED') {
        await job.moveToDelayed(Date.now() + LOCKED_RETRY_MS, token);
        throw new DelayedError();
      }

      await this.agenda.invalidateToday(userId);
      return outcome;
    }

    if (job.name === REMOVE_FROM_PATH_JOB) {
      const { userId, lessonId } = job.data as RemoveFromPathJobData;
      await this.plans.removeFromPath(userId, lessonId);
      await this.agenda.invalidateToday(userId);
      return { done: true };
    }

    if (job.name === ADD_REINFORCEMENT_JOB) {
      const { userId, skillIds } = job.data as AddReinforcementJobData;
      await this.plans.addReinforcement(userId, skillIds);
      await this.agenda.invalidateToday(userId);
      return { done: true };
    }

    if (job.name === DAILY_TICK_JOB) {
      const { timezone } = job.data as DailyTickJobData;
      return this.runDailyTick(timezone);
    }

    return { skipped: true };
  }

  /**
   * Um fuso inteiro bateu 00:30. Enfileira um rebuild por aluno daquele
   * fuso, um job por vez — mantém o forecast em dia e libera a agenda do
   * novo dia local, sem segurar o worker desse tick processando todo mundo
   * em série.
   */
  private async runDailyTick(timezone: string): Promise<{ enqueued: number }> {
    const rows = await this.prisma.studentProfile.findMany({
      where: { timezone, onboardingCompletedAt: { not: null } },
      select: { userId: true },
    });
    const today = new Date().toISOString().slice(0, 10);

    for (const row of rows) {
      await this.queue.add(
        REBUILD_JOB,
        { userId: row.userId },
        { jobId: `rebuild-${row.userId}-daily-${today}` },
      );
    }

    return { enqueued: rows.length };
  }
}
