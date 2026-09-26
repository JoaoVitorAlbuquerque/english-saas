import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import { ProgressQueryDto } from '../dto/progress.dto';
import { StudentProgressService } from '../services/student-progress.service';

@ApiTags('progress')
@Controller('me/progress')
export class ProgressController {
  constructor(private readonly progress: StudentProgressService) {}

  @Get()
  @ApiOperation({
    summary:
      'Painel do aluno: nível e evolução, forças e fraquezas, estatísticas, cronograma e previsão',
  })
  async get(@ActiveUserId() userId: string, @Query() query: ProgressQueryDto) {
    return this.progress.get(userId, query.weeks);
  }
}
