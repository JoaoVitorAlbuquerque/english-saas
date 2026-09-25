import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { DailyAgendaScheduler } from './daily-agenda.scheduler';
import {
  ADD_REINFORCEMENT_JOB,
  REBUILD_JOB,
  REMOVE_FROM_PATH_JOB,
} from './planner-jobs';

/**
 * O que mexe no plano: `lesson.completed` tira a lição do path;
 * `checkpoint.completed` com reforço acrescenta skill de reforço;
 * `placement.completed`, `user.onboarded` e `profile.availability_changed`
 * mudam o ponto de partida ou a disponibilidade — refazem o plano inteiro.
 */
@Injectable()
export class PlannerListener {
  constructor(
    @InjectQueue(QUEUES.PLANNER) private readonly queue: Queue,
    private readonly dailyAgenda: DailyAgendaScheduler,
  ) {}

  @OnEvent('lesson.completed')
  async onLessonCompleted(
    event: DomainEvent<'lesson.completed'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined) {
      return;
    }

    await this.queue.add(
      REMOVE_FROM_PATH_JOB,
      { userId, lessonId: payload.lessonId },
      { jobId: `path-remove-${payload.attemptId}` },
    );
  }

  @OnEvent('checkpoint.completed')
  async onCheckpointCompleted(
    event: DomainEvent<'checkpoint.completed'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (
      userId === undefined ||
      (payload.result !== 'NEEDS_REINFORCEMENT' &&
        payload.result !== 'PASSED_WITH_REINFORCEMENT')
    ) {
      return;
    }

    await this.queue.add(
      ADD_REINFORCEMENT_JOB,
      { userId, skillIds: payload.reinforceSkillIds },
      { jobId: `reinforce-${payload.checkpointId}` },
    );
  }

  @OnEvent('placement.completed')
  async onPlacementCompleted(
    event: DomainEvent<'placement.completed'>,
  ): Promise<void> {
    await this.enqueueRebuild(event.userId);
  }

  @OnEvent('user.onboarded')
  async onUserOnboarded(event: DomainEvent<'user.onboarded'>): Promise<void> {
    await this.enqueueRebuild(event.userId);
  }

  /**
   * Fuso pode ter mudado (ou ser a primeira vez que aparece): garante o
   * cron diário desse fuso antes de refazer o plano.
   */
  @OnEvent('profile.availability_changed')
  async onAvailabilityChanged(
    event: DomainEvent<'profile.availability_changed'>,
  ): Promise<void> {
    await this.dailyAgenda.ensureTimezoneJob(event.payload.timezone);
    await this.enqueueRebuild(event.userId);
  }

  private async enqueueRebuild(userId: string | undefined): Promise<void> {
    if (userId === undefined) {
      return;
    }

    await this.queue.add(
      REBUILD_JOB,
      { userId },
      { jobId: `rebuild-${userId}` },
    );
  }
}
