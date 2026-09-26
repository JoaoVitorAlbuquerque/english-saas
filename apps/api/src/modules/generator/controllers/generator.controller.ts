import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { RequiresFeature } from 'src/common/decorators/requires-feature.decorator';
import { RequiresFeatureGuard } from 'src/modules/billing/guards/requires-feature.guard';

import {
  GenerateTopicDto,
  IngestContentDto,
  SuggestTopicsDto,
} from '../dto/generator.dto';
import { GenerationRequestService } from '../services/generation-request.service';

/**
 * Pedidos ao generator (Plus). Tudo roda em job: as rotas de escrita
 * respondem 202 com o pedido, e o app acompanha etapa por etapa em
 * `GET /generator/jobs/:id`.
 */
@ApiTags('generator')
@Controller('generator')
@UseGuards(RequiresFeatureGuard)
export class GeneratorController {
  constructor(private readonly requests: GenerationRequestService) {}

  @Post('topic/suggest')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequiresFeature('GENERATOR_TOPIC')
  @ApiOperation({ summary: 'Três assuntos reais a partir de um interesse' })
  async suggest(
    @ActiveUserId() userId: string,
    @Body() body: SuggestTopicsDto,
  ) {
    return this.requests.suggest(userId, body);
  }

  @Post('topic')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequiresFeature('GENERATOR_TOPIC')
  @ApiOperation({ summary: 'Material sobre um assunto real (5 créditos)' })
  async topic(@ActiveUserId() userId: string, @Body() body: GenerateTopicDto) {
    return this.requests.topic(userId, body);
  }

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequiresFeature('GENERATOR_INGEST')
  @ApiOperation({
    summary: 'Material a partir de um texto ou link do aluno (5 créditos)',
  })
  async ingest(@ActiveUserId() userId: string, @Body() body: IngestContentDto) {
    return this.requests.ingest(userId, body);
  }

  /** Sem trava de plano: o pedido já feito é do aluno. */
  @Get('jobs/:id')
  @ApiOperation({ summary: 'Situação do pedido, etapa por etapa' })
  async job(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.requests.get(userId, id);
  }
}
