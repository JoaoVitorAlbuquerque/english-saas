import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import { AssessmentAnswerDto } from '../dto/assessment.dto';
import { PlacementService } from '../services/placement.service';

@ApiTags('assessment')
@Controller('placement')
export class PlacementController {
  constructor(private readonly placement: PlacementService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Começa o teste de nível, ou retoma o que está aberto',
  })
  async start(@ActiveUserId() userId: string) {
    return this.placement.start(userId);
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
    return this.placement.answer(userId, id, body);
  }

  @Get('latest')
  @ApiOperation({
    summary: 'O último teste de nível e quando dá para refazer',
  })
  async latest(@ActiveUserId() userId: string) {
    return this.placement.latest(userId);
  }
}
