import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import {
  CorrectionAudioDto,
  CreateCorrectionDto,
  RoleplayTurnDto,
  StartRoleplayDto,
} from '../dto/tutor.dto';
import { CorrectionService } from '../services/correction.service';
import { RoleplayService } from '../services/roleplay.service';
import { VoiceGate, type UploadedAudio } from '../services/voice-gate';

/**
 * O tutor com IA. Tudo que chama IA roda em job: as rotas de escrita
 * respondem 202 e o cliente acompanha pelo GET (polling).
 */
@ApiTags('tutor')
@Controller('tutor')
export class TutorController {
  constructor(
    private readonly corrections: CorrectionService,
    private readonly roleplays: RoleplayService,
    private readonly voice: VoiceGate,
  ) {}

  @Post('corrections')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pede a correção de um texto (1 crédito)' })
  async correct(
    @ActiveUserId() userId: string,
    @Body() body: CreateCorrectionDto,
  ) {
    return this.corrections.create(userId, body);
  }

  @Post('corrections/audio')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio'))
  @ApiOperation({
    summary: 'Correção a partir de áudio (desligada por padrão)',
  })
  async correctAudio(
    @ActiveUserId() userId: string,
    @Body() body: CorrectionAudioDto,
    @UploadedFile() file: UploadedAudio | undefined,
  ) {
    return this.corrections.createFromAudio(
      userId,
      body,
      this.voice.accept(file),
    );
  }

  @Get('corrections/:id')
  @ApiOperation({ summary: 'Situação e resultado de uma correção' })
  async correction(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.corrections.get(userId, id);
  }

  @Post('roleplays')
  @ApiOperation({ summary: 'Começa um roleplay (3 créditos por sessão)' })
  async startRoleplay(
    @ActiveUserId() userId: string,
    @Body() body: StartRoleplayDto,
  ) {
    return this.roleplays.start(
      userId,
      body.scenarioFreeText !== undefined
        ? { scenarioFreeText: body.scenarioFreeText }
        : { lessonId: body.lessonId ?? '', stepIndex: body.stepIndex ?? 0 },
    );
  }

  @Get('roleplays/:id')
  @ApiOperation({ summary: 'A conversa, as metas e o resumo quando terminar' })
  async roleplay(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.roleplays.get(userId, id);
  }

  @Post('roleplays/:id/turns')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Fala do aluno; a resposta chega pelo GET' })
  async turn(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RoleplayTurnDto,
  ) {
    return this.roleplays.submitTurn(userId, id, body);
  }

  @Post('roleplays/:id/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encerra a conversa e gera o resumo' })
  async finish(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.roleplays.finish(userId, id);
  }
}
