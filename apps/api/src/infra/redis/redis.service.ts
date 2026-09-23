import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { EnvService } from 'src/common/config/env.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(envService: EnvService) {
    this.client = new Redis(envService.get('REDIS_URL'), {
      // Exigido pelo BullMQ e evita comandos enfileirados sem fim.
      maxRetriesPerRequest: null,
      lazyConnect: false,
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
