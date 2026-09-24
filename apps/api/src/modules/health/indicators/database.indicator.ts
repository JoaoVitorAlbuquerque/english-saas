import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async check(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    const startedAt = Date.now();

    try {
      await this.prisma.ping();
      return check.up({ latencyMs: Date.now() - startedAt });
    } catch (error) {
      return check.down({
        latencyMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : 'erro desconhecido',
      });
    }
  }
}
