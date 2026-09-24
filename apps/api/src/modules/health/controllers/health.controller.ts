import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { HEALTH_INDICATORS } from '@english-saas/shared';

import { IsPublic } from 'src/common/decorators/is-public.decorator';

import { DatabaseHealthIndicator } from '../indicators/database.indicator';
import { RedisHealthIndicator } from '../indicators/redis.indicator';
import { StorageHealthIndicator } from '../indicators/storage.indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly storage: StorageHealthIndicator,
  ) {}

  /**
   * Usado pelo docker compose, pelo deploy e pelo monitoramento.
   * Responde 503 quando qualquer dependência está fora.
   */
  @IsPublic()
  @SkipThrottle()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Saúde da API: banco, Redis e storage' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.check(HEALTH_INDICATORS.DATABASE),
      () => this.redis.check(HEALTH_INDICATORS.REDIS),
      () => this.storage.check(HEALTH_INDICATORS.STORAGE),
    ]);
  }
}
