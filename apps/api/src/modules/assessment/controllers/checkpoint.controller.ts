import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import { AssessmentAnswerDto } from '../dto/assessment.dto';
import { CheckpointService } from '../services/checkpoint.service';

@ApiTags('assessment')
@Controller('checkpoints')
export class CheckpointController {
  constructor(private readonly checkpoints: CheckpointService) {}

  @Post(':unitId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Começa o checkpoint da unidade, ou retoma o que está aberto',
  })
  async start(
    @ActiveUserId() userId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.checkpoints.start(userId, unitId);
  }

  @Post(':id/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Responde a questão da vez: devolve a próxima ou o resultado',
  })
  async answer(
    @ActiveUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssessmentAnswerDto,
  ) {
    return this.checkpoints.answer(userId, id, body);
  }
}
