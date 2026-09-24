import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { StorageService } from 'src/infra/storage/storage.service';

@Injectable()
export class StorageHealthIndicator {
  constructor(
    private readonly storage: StorageService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async check(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    const startedAt = Date.now();

    try {
      await this.storage.ping();
      return check.up({ latencyMs: Date.now() - startedAt });
    } catch (error) {
      return check.down({
        latencyMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : 'erro desconhecido',
      });
    }
  }
}
