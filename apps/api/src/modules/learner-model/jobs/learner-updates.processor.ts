import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, type Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import {
  LEARNER_UPDATE_JOB,
  LearnerUpdateService,
} from '../services/learner-update.service';

type LearnerUpdateJobData = { userId: string };

/** Espera quando outro worker está com o mesmo aluno. */
const LOCKED_RETRY_MS = 500;

/**
 * Processa as respostas novas de um aluno.
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
    job: Job<LearnerUpdateJobData>,
    token?: string,
  ): Promise<unknown> {
    if (job.name !== LEARNER_UPDATE_JOB) {
      return { skipped: true };
    }

    const outcome = await this.updates.process(job.data.userId);

    if (outcome.status === 'LOCKED') {
      await job.moveToDelayed(Date.now() + LOCKED_RETRY_MS, token);
      throw new DelayedError();
    }

    return outcome;
  }
}
