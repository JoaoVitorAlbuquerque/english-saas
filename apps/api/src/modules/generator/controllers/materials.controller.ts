import {
  Body,
  Controller,
  Delete,
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
import { CursorPaginationQueryDto } from 'src/common/pagination/cursor-pagination.dto';

import { MaterialAnswerDto, MaterialFeedbackDto } from '../dto/generator.dto';
import { MaterialService } from '../services/material.service';

/**
 * "Seus materiais". Sem trava de plano: o que já foi gerado continua do
 * aluno depois de um downgrade — só gerar material novo exige o Plus.
 */
@ApiTags('generator')
@Controller('me/materials')
export class MaterialsController {
  constructor(private readonly materials: MaterialService) {}

  @Get()
  @ApiOperation({ summary: 'Materiais do aluno, do mais novo ao mais antigo' })
  async list(
    @ActiveUserId() userId: string,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.materials.list(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Texto, destaques, conversa e exercícios' })
  async get(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.materials.get(userId, id);
  }

  @Post(':id/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Responde um exercício do material' })
  async answer(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MaterialAnswerDto,
  ) {
    return this.materials.answer(userId, id, body);
  }

  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nota e dificuldade (ajusta interesse e nível)' })
  async feedback(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MaterialFeedbackDto,
  ) {
    return this.materials.feedback(userId, id, body);
  }

  @Post(':id/vocabulary/:termKey/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Põe um termo do vocabulário na revisão (idempotente)',
  })
  async addTermToReview(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('termKey') termKey: string,
  ) {
    return this.materials.addTermToReview(userId, id, termKey);
  }

  @Delete(':id/vocabulary/:termKey/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tira um termo da revisão — suspende o card (idempotente)',
  })
  async removeTermFromReview(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('termKey') termKey: string,
  ) {
    return this.materials.removeTermFromReview(userId, id, termKey);
  }
}
