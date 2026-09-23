import { Injectable } from '@nestjs/common';
import type { DependencyStatus, HealthResponse } from '@english-saas/shared';

import { PrismaService } from 'src/infra/database/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';

import { summarizeHealth } from '../domain/summarize-health';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.probe(() => this.prisma.ping()),
      this.probe(() => this.redis.ping()),
    ]);

    const dependencies = { database, redis };

    return {
      status: summarizeHealth(dependencies),
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  private async probe(run: () => Promise<unknown>): Promise<DependencyStatus> {
    const startedAt = Date.now();

    try {
      await run();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'erro desconhecido',
      };
    }
  }
}
