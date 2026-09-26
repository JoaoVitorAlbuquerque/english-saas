import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';

import { Roles } from 'src/common/decorators/roles.decorator';
import { QUEUES } from 'src/infra/queue/queues';

import { AdminMetricsQueryDto, RebuildMetricsDto } from '../dto/progress.dto';
import { AGGREGATE_RANGE_JOB } from '../jobs/progress-jobs';
import { AdminMetricsService } from '../services/admin-metrics.service';

/** Métricas da plataforma. Restrito a ADMIN; o painel vem no módulo 17. */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/metrics')
export class AdminMetricsController {
  constructor(
    private readonly metrics: AdminMetricsService,
    @InjectQueue(QUEUES.PROGRESS) private readonly queue: Queue,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Atividade, retenção, lições, itens problemáticos, custo de IA e receita',
  })
  async get(@Query() query: AdminMetricsQueryDto) {
    const range =
      query.from !== undefined && query.to !== undefined
        ? { from: query.from, to: query.to }
        : this.metrics.defaultRange();

    return this.metrics.get(range.from, range.to);
  }

  @Post('rebuild')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reprocessa as tabelas diárias de um intervalo' })
  async rebuild(@Body() body: RebuildMetricsDto) {
    const job = await this.queue.add(AGGREGATE_RANGE_JOB, {
      from: body.from,
      to: body.to,
    });

    return { jobId: job.id ?? null, from: body.from, to: body.to };
  }
}
