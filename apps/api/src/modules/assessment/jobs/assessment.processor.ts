import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import {
  CalibrationService,
  ITEM_CALIBRATION_JOB,
} from '../services/calibration.service';

/** Calibração semanal dos itens. Um job por vez: ela varre o banco inteiro. */
@Processor(QUEUES.ASSESSMENT, defaultWorkerOptions({ concurrency: 1 }))
export class AssessmentProcessor extends WorkerHost {
  private readonly logger = new Logger(AssessmentProcessor.name);

  constructor(private readonly calibration: CalibrationService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === ITEM_CALIBRATION_JOB) {
      return this.calibration.run();
    }

    this.logger.warn(
      { jobName: job.name },
      'Job desconhecido na fila assessment',
    );
    return { skipped: true };
  }
}
