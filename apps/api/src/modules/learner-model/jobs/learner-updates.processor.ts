import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Competency } from '@prisma/client';
import { DelayedError, type Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import {
  LEARNER_UPDATE_JOB,
  LearnerUpdateService,
  PLACEMENT_PRIOR_JOB,
  type UpdateOutcome,
} from '../services/learner-update.service';

type LearnerUpdateJobData = { userId: string };

type PlacementPriorJobData = {
  userId: string;
  placementId: string;
  theta: number;
  competencyThetas: Partial<Record<Competency, number>>;
  completedAt: string;
};

/** Espera quando outro worker está com o mesmo aluno. */
const LOCKED_RETRY_MS = 500;

/**
 * Processa as atualizações do modelo de um aluno: respostas novas e o
 * resultado do nivelamento.
 *
 * Aluno travado (outro worker já está nele) não é falha: o job volta para a
 * fila atrasado, sem gastar tentativa. Quando rodar de novo, ou já não há
 * nada a fazer — o outro processou tudo — ou pega o que chegou depois.
 */
@Processor(QUEUES.LEARNER_UPDATES, defaultWorkerOptions())
export class LearnerUpdatesProcessor extends WorkerHost {
  constructor(private readonly updates: LearnerUpdateService) {
    super();
  }

  async process(
    job: Job<LearnerUpdateJobData | PlacementPriorJobData>,
    token?: string,
  ): Promise<unknown> {
    let outcome: UpdateOutcome;

    if (job.name === LEARNER_UPDATE_JOB) {
      outcome = await this.updates.process(job.data.userId);
    } else if (job.name === PLACEMENT_PRIOR_JOB) {
      const data = job.data as PlacementPriorJobData;
      outcome = await this.updates.applyPlacement(data.userId, {
        placementId: data.placementId,
        theta: data.theta,
        competencyThetas: data.competencyThetas,
        completedAt: new Date(data.completedAt),
      });
    } else {
      return { skipped: true };
    }

    if (outcome.status === 'LOCKED') {
      await job.moveToDelayed(Date.now() + LOCKED_RETRY_MS, token);
      throw new DelayedError();
    }

    return outcome;
  }
}
