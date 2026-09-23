import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@english-saas/shared';
import type { Response } from 'express';

import { IsPublic } from 'src/common/decorators/is-public.decorator';

import { HealthService } from '../services/health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Usado pelo `docker compose`, pelo deploy e pelo monitoramento.
   * Responde 503 quando banco ou Redis estão fora.
   */
  @IsPublic()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthResponse> {
    const result = await this.healthService.check();

    if (result.status === 'error') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
