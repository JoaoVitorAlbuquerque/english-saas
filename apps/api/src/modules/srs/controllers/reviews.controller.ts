import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import { ReviewAnswerDto, ReviewSessionQueryDto } from '../dto/srs.dto';
import { ReviewAnswerService } from '../services/review-answer.service';
import { ReviewSessionService } from '../services/review-session.service';

@ApiTags('srs')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly sessions: ReviewSessionService,
    private readonly answers: ReviewAnswerService,
  ) {}

  @Get('session')
  @ApiOperation({
    summary: 'Monta a sessão de revisão que cabe no tempo do aluno',
  })
  async session(
    @ActiveUserId() userId: string,
    @Query() query: ReviewSessionQueryDto,
  ) {
    return this.sessions.build(userId, query.minutes);
  }

  @Post(':cardId/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Responde um card de revisão' })
  async answer(
    @ActiveUserId() userId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() body: ReviewAnswerDto,
  ) {
    return this.answers.answer(userId, cardId, body);
  }
}
