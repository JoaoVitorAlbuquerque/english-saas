import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import {
  DATA_EXPORT_JOB,
  DataExportService,
  type DataExportJobData,
} from '../services/data-export.service';
import { UsersService } from '../services/users.service';

export const ANONYMIZE_SWEEP_JOB = 'anonymize-sweep';

type UsersJobData = DataExportJobData | Record<string, never>;

/**
 * Jobs do módulo: export de dados e varredura de anonimização.
 *
 * A varredura é um job repetível diário em vez de um job atrasado em 30
 * dias: atraso longo depende do Redis sobreviver o mês inteiro, a varredura
 * só olha o banco e é idempotente.
 */
@Processor(QUEUES.USERS, defaultWorkerOptions())
export class UsersProcessor extends WorkerHost {
  private readonly logger = new Logger(UsersProcessor.name);

  constructor(
    private readonly dataExport: DataExportService,
    private readonly users: UsersService,
  ) {
    super();
  }

  async process(job: Job<UsersJobData>): Promise<unknown> {
    switch (job.name) {
      case DATA_EXPORT_JOB:
        await this.dataExport.run(job.data as DataExportJobData);
        return { exported: true };

      case ANONYMIZE_SWEEP_JOB:
        return this.anonymizeSweep();

      default:
        this.logger.warn(
          { jobName: job.name },
          'Job desconhecido na fila users',
        );
        return { skipped: true };
    }
  }

  private async anonymizeSweep(): Promise<{ anonymized: number }> {
    const due = await this.users.findDueForAnonymization();

    for (const userId of due) {
      await this.users.anonymize(userId);
    }

    if (due.length > 0) {
      this.logger.log(
        { count: due.length },
        'Contas anonimizadas na varredura',
      );
    }

    return { anonymized: due.length };
  }
}
