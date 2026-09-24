import { BullModule } from '@nestjs/bullmq';
import type { DynamicModule } from '@nestjs/common';
import type { JobsOptions, WorkerOptions } from 'bullmq';

import type { QueueName } from './queues';

/**
 * Os defaults de fila vivem aqui e não no EnvService porque o decorator
 * `@Processor` é avaliado na importação do módulo, antes de o Nest existir.
 * Os fallbacks são os mesmos do `envSchema`, então os dois não divergem.
 */
function envNumber(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Opções padrão de job: retry com backoff exponencial e limpeza. */
export function defaultJobOptions(): JobsOptions {
  return {
    attempts: envNumber('QUEUE_ATTEMPTS', 3),
    backoff: {
      type: 'exponential',
      delay: envNumber('QUEUE_BACKOFF_MS', 2_000),
    },
    // Job concluído some em 24h; falho fica 7 dias para investigação.
    removeOnComplete: { age: 24 * 3600, count: 1_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  };
}

/**
 * Opções padrão de worker. Passe para o `@Processor`:
 *
 *   @Processor(QUEUES.AI, defaultWorkerOptions())
 */
export function defaultWorkerOptions(
  overrides: Partial<WorkerOptions> = {},
): Partial<WorkerOptions> {
  return {
    concurrency: envNumber('QUEUE_CONCURRENCY', 5),
    ...overrides,
  };
}

/**
 * Registra uma fila com os defaults do projeto.
 *
 * Use no `imports` do módulo dono da fila, em vez de chamar
 * `BullModule.registerQueue` direto — assim retry, backoff e limpeza ficam
 * iguais em todas elas.
 */
export function registerQueue(
  name: QueueName,
  overrides: JobsOptions = {},
): DynamicModule {
  return BullModule.registerQueue({
    name,
    defaultJobOptions: { ...defaultJobOptions(), ...overrides },
  });
}
