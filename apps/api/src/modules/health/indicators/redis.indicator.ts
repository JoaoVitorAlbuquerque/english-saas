import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { RedisService } from 'src/infra/redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redis: RedisService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async check(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    const startedAt = Date.now();

    try {
      const pong = await this.redis.ping();

      if (pong !== 'PONG') {
        return check.down({ reason: `resposta inesperada: ${pong}` });
      }

      return check.up({ latencyMs: Date.now() - startedAt });
    } catch (error) {
      return check.down({
        latencyMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : 'erro desconhecido',
      });
    }
  }
}
