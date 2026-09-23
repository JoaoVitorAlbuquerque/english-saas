import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

/**
 * Configuração base do BullMQ. Cada módulo registra as próprias filas com
 * `BullModule.registerQueue({ name: QUEUES.X })` e herda estes defaults.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [EnvService],
      useFactory: (envService: EnvService) => {
        const url = new URL(envService.get('REDIS_URL'));

        return {
          prefix: envService.get('QUEUE_PREFIX'),
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: { age: 24 * 3600, count: 1_000 },
            removeOnFail: { age: 7 * 24 * 3600 },
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
