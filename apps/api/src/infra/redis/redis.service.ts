import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';

import { EnvService } from 'src/common/config/env.service';

/** Opções exigidas pelo BullMQ e que valem para todo cliente nosso. */
export function buildRedisOptions(url: string): RedisOptions & { url: string } {
  const parsed = new URL(url);

  return {
    url,
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.username ? { username: parsed.username } : {}),
    ...(parsed.password ? { password: parsed.password } : {}),
    // O BullMQ exige null: ele não pode ter comando abortado por retry.
    maxRetriesPerRequest: null,
  };
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(private readonly envService: EnvService) {
    this.client = new Redis(this.envService.get('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error({ err: error }, 'Erro de conexão com o Redis');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Usado pelo health check. */
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
