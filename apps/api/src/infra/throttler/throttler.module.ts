import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler';

import { EnvModule } from 'src/common/config/env.module';
import { EnvService } from 'src/common/config/env.service';

/**
 * Rate limit global por IP, com o contador no Redis — assim o limite vale
 * para o conjunto das instâncias, não por processo.
 */
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        throttlers: [
          {
            ttl: envService.get('THROTTLE_TTL_SECONDS') * 1_000,
            limit: envService.get('THROTTLE_LIMIT'),
          },
        ],
        storage: new ThrottlerStorageRedisService(envService.get('REDIS_URL')),
      }),
    }),
  ],
  exports: [NestThrottlerModule],
})
export class ThrottlerModule {}
