import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { CursorPaginationQueryDto } from 'src/common/pagination/cursor-pagination.dto';

import { AttemptService } from '../services/attempt.service';

@ApiTags('learning')
@Controller('me')
export class HistoryController {
  constructor(private readonly attempts: AttemptService) {}

  @Get('history')
  @ApiOperation({ summary: 'Lições que o aluno fez, mais recente primeiro' })
  async history(
    @ActiveUserId() userId: string,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.attempts.history(userId, query);
  }
}
