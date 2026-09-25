import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import {
  CompleteStepDto,
  StartAttemptDto,
  SubmitAnswerDto,
} from '../dto/learning.dto';
import { AnswerService } from '../services/answer.service';
import { AttemptService } from '../services/attempt.service';

/**
 * O player da lição.
 *
 * Nada trava por progresso: o aluno faz as lições em qualquer ordem. O que
 * trava é o plano — lição fora dele dá 403 `PLAN_REQUIRED` ao iniciar e ao
 * responder em contexto LESSON. Revisão (REVIEW) nunca trava.
 */
@ApiTags('learning')
@Controller()
export class LessonPlayerController {
  constructor(
    private readonly attempts: AttemptService,
    private readonly answers: AnswerService,
  ) {}

  @Post('lessons/:id/attempts')
  @ApiOperation({
    summary: 'Inicia a lição, ou retoma a tentativa aberta (200)',
  })
  async start(
    @ActiveUserId() userId: string,
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body() body: StartAttemptDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { attempt, resumed } = await this.attempts.start(
      userId,
      lessonId,
      body.source,
    );

    res.status(resumed ? HttpStatus.OK : HttpStatus.CREATED);

    return { ...attempt, resumed };
  }

  @Post('attempts/:id/steps/:index/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conclui uma etapa. Repetir é inofensivo.' })
  async completeStep(
    @ActiveUserId() userId: string,
    @Param('id', ParseUUIDPipe) attemptId: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() body: CompleteStepDto,
  ) {
    return this.attempts.completeStep(userId, attemptId, index, body);
  }

  @Post('attempts/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conclui a lição: soma XP e atualiza a sequência' })
  async complete(
    @ActiveUserId() userId: string,
    @Param('id', ParseUUIDPipe) attemptId: string,
  ) {
    return this.attempts.complete(userId, attemptId);
  }

  @Post('answers')
  @ApiOperation({
    summary: 'Responde uma questão: corrige na hora e devolve o feedback',
  })
  async answer(@ActiveUserId() userId: string, @Body() body: SubmitAnswerDto) {
    return this.answers.record({ userId, ...body });
  }
}
