import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IsPublic } from 'src/common/decorators/is-public.decorator';

import { ExampleQueueService } from './example-queue.service';

class EnqueueExampleJobDto extends createZodDto(
  z.object({
    message: z.string().min(1).max(200).default('ping'),
  }),
) {}

/**
 * Endpoint de demonstração da fila. Fica atrás da mesma basic auth do Bull
 * Board e sai junto com o processor de exemplo.
 */
@ApiTags('admin')
@Controller('admin/example-jobs')
export class ExampleController {
  constructor(private readonly exampleQueue: ExampleQueueService) {}

  @IsPublic()
  @Post()
  @ApiOperation({
    summary:
      'Enfileira um job de exemplo e devolve o id (não espera o processamento)',
  })
  async enqueue(
    @Body() body: EnqueueExampleJobDto,
  ): Promise<{ jobId: string }> {
    return this.exampleQueue.enqueue(body.message);
  }

  @IsPublic()
  @Get()
  @ApiOperation({ summary: 'Contagem de jobs da fila de exemplo por estado' })
  async counts(): Promise<Record<string, number>> {
    return this.exampleQueue.countJobs();
  }
}
