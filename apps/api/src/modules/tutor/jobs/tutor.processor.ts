import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { AppException } from 'src/common/errors/app.exception';
import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import { CorrectionService } from '../services/correction.service';
import { RoleplayService } from '../services/roleplay.service';
import {
  CORRECT_JOB,
  ROLEPLAY_TURN_JOB,
  TRANSCRIBE_JOB,
  type CorrectionJobData,
  type RoleplayTurnJobData,
} from './tutor-jobs';

/**
 * Jobs do tutor. Falhou na última tentativa: a correção vira FAILED e o
 * crédito volta; o turno de roleplay volta para o aluno reenviar.
 */
@Processor(QUEUES.TUTOR, defaultWorkerOptions())
export class TutorProcessor extends WorkerHost {
  constructor(
    private readonly corrections: CorrectionService,
    private readonly roleplays: RoleplayService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    try {
      switch (job.name) {
        case TRANSCRIBE_JOB:
          return await this.corrections.transcribe(
            (job.data as CorrectionJobData).correctionId,
          );
        case CORRECT_JOB:
          return await this.corrections.process(
            (job.data as CorrectionJobData).correctionId,
          );
        case ROLEPLAY_TURN_JOB:
          return await this.roleplays.processTurn(
            (job.data as RoleplayTurnJobData).turnId,
          );
        default:
          return { skipped: true };
      }
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.giveUp(job, error);
      }

      throw error;
    }
  }

  private async giveUp(job: Job, error: unknown): Promise<void> {
    const code = error instanceof AppException ? error.code : 'UNEXPECTED';

    if (job.name === ROLEPLAY_TURN_JOB) {
      await this.roleplays.failTurn((job.data as RoleplayTurnJobData).turnId);
      return;
    }

    await this.corrections.fail(
      (job.data as CorrectionJobData).correctionId,
      code,
    );
  }
}
