import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { defaultJobOptions } from './register-queue';

/**
 * Conexão e defaults do BullMQ. As filas em si são registradas pelo módulo
 * dono de cada uma, com o helper `registerQueue`.
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
            ...(url.username ? { username: url.username } : {}),
            ...(url.password ? { password: url.password } : {}),
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: defaultJobOptions(),
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
