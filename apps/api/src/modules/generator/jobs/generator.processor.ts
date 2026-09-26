import { Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError, type Job } from 'bullmq';

import { AppException } from 'src/common/errors/app.exception';
import { QUEUES } from 'src/infra/queue/queues';
import { defaultWorkerOptions } from 'src/infra/queue/register-queue';

import { FinalGenerationError } from '../generator.errors';
import { GenerationPipelineService } from '../services/generation-pipeline.service';
import {
  INGEST_JOB,
  SUGGEST_JOB,
  TOPIC_JOB,
  type GenerationJobData,
} from './generator-jobs';

/**
 * Jobs do generator. Um só caminho para os três tipos de pedido: o
 * pipeline sabe as etapas de cada um.
 *
 * Erro que não melhora tentando (fonte inexistente, página proibida pelo
 * robots.txt, nível impossível) desiste na hora, com estorno; o resto tenta
 * de novo e, na última tentativa, desiste do mesmo jeito.
 */
@Processor(QUEUES.GENERATOR, defaultWorkerOptions())
export class GeneratorProcessor extends WorkerHost {
  constructor(private readonly pipeline: GenerationPipelineService) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<unknown> {
    if (![SUGGEST_JOB, TOPIC_JOB, INGEST_JOB].includes(job.name)) {
      return { skipped: true };
    }

    try {
      return await this.pipeline.run(job.data.generationJobId);
    } catch (error) {
      const final = error instanceof FinalGenerationError;

      if (final || job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.pipeline.fail(
          job.data.generationJobId,
          error instanceof AppException ? error.code : 'UNEXPECTED',
        );
      }

      if (final) {
        throw new UnrecoverableError(error.code);
      }

      throw error;
    }
  }
}
