import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import { LearningStatsService } from '../services/learning-stats.service';

@ApiTags('learning')
@Controller('me/stats')
export class StatsController {
  constructor(private readonly stats: LearningStatsService) {}

  @Get()
  @ApiOperation({
    summary:
      'XP total e sequência do aluno, no fuso dele — sem registrar estudo',
  })
  async get(@ActiveUserId() userId: string) {
    return this.stats.get(userId);
  }
}
