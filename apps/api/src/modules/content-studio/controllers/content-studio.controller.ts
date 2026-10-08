import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommentTarget } from '@prisma/client';
import { Queue } from 'bullmq';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { QUEUES } from 'src/infra/queue/queues';

import {
  CommentListQueryDto,
  CreateCommentDto,
  DraftEstimateQueryDto,
  DraftListQueryDto,
  RegenerateAudioDto,
  RequestItemsDraftDto,
  RequestLessonDraftDto,
  RequestRegisterNotesDraftDto,
} from '../dto/content-studio.dto';
import { AudioReviewService } from '../services/audio-review.service';
import { DraftService } from '../services/draft.service';
import { QaService } from '../services/qa.service';
import { ReviewService } from '../services/review.service';
import { TTS_GENERATE_JOB } from '../services/tts.service';
import {
  WORKBOOK_PDF_JOB,
  WorkbookService,
} from '../services/workbook.service';

/**
 * Estúdio de conteúdo. Restrito a EDITOR e ADMIN.
 *
 * Tudo que gera conteúdo aqui devolve **202 e um id de rascunho**: uma lição
 * inteira leva dezenas de segundos de IA e não cabe num request (CLAUDE.md,
 * "Trabalho pesado vai para a fila"). O editor acompanha por
 * `GET /drafts/:id`.
 *
 * Aprovar e pedir alterações continuam em `/admin/curriculum` — são o
 * `approve` e o `reject` do módulo 4.
 */
@ApiTags('content-studio')
@Roles('EDITOR', 'ADMIN')
@Controller('admin/content-studio')
export class ContentStudioController {
  constructor(
    private readonly drafts: DraftService,
    private readonly qa: QaService,
    private readonly review: ReviewService,
    private readonly audio: AudioReviewService,
    private readonly workbooks: WorkbookService,
    @InjectQueue(QUEUES.MEDIA) private readonly media: Queue,
  ) {}

  // --- Rascunhos ---

  @Post('drafts/lesson')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pede à IA o rascunho de uma lição inteira' })
  async requestLesson(
    @ActiveUserId() userId: string,
    @Body() body: RequestLessonDraftDto,
  ) {
    return this.drafts.requestLesson(userId, body);
  }

  @Post('drafts/items')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pede questões avulsas para uma skill' })
  async requestItems(
    @ActiveUserId() userId: string,
    @Body() body: RequestItemsDraftDto,
  ) {
    return this.drafts.requestItems(userId, body);
  }

  @Post('drafts/register-notes')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pede notas de registro falado' })
  async requestRegisterNotes(
    @ActiveUserId() userId: string,
    @Body() body: RequestRegisterNotesDraftDto,
  ) {
    return this.drafts.requestRegisterNotes(userId, body);
  }

  @Get('drafts')
  @ApiOperation({ summary: 'Rascunhos, paginado por cursor' })
  async listDrafts(@Query() query: DraftListQueryDto) {
    return this.drafts.list(query);
  }

  /** Antes de `drafts/:id`: senão `estimate` seria lido como um id. */
  @Get('drafts/estimate')
  @ApiOperation({
    summary: 'Custo estimado de um pedido, pela média dos últimos prontos',
  })
  async estimateDraft(@Query() query: DraftEstimateQueryDto) {
    return this.drafts.estimate(query.kind, query.count);
  }

  @Get('drafts/:id')
  @ApiOperation({
    summary: 'Estado do rascunho, custo e avisos da revisão automática',
  })
  async findDraft(@Param('id') id: string) {
    return this.drafts.findById(id);
  }

  @Post('drafts/:id/discard')
  @ApiOperation({ summary: 'Descarta o rascunho e arquiva o que ele criou' })
  async discardDraft(@Param('id') id: string) {
    return this.drafts.discard(id);
  }

  // --- Revisão automática ---

  @Post('qa/lesson-versions/:id')
  @ApiOperation({ summary: 'Roda a revisão automática de novo' })
  async runQa(@Param('id') id: string) {
    await this.qa.runForVersion(id);

    return this.qa.latestFor(id);
  }

  @Get('qa/lesson-versions/:id')
  @ApiOperation({ summary: 'Último relatório de revisão automática' })
  async latestQa(@Param('id') id: string) {
    return this.qa.latestFor(id);
  }

  // --- Revisão humana ---

  @Get('lesson-versions/:id/comments')
  @ApiOperation({ summary: 'Comentários da versão' })
  async listComments(
    @Param('id') id: string,
    @Query() query: CommentListQueryDto,
  ) {
    return this.review.listComments(id, query.includeResolved ?? false);
  }

  @Post('lesson-versions/:id/comments')
  @ApiOperation({ summary: 'Comenta numa etapa ou numa questão' })
  async comment(
    @Param('id') id: string,
    @ActiveUserId() userId: string,
    @Body() body: CreateCommentDto,
  ) {
    return this.review.comment(id, userId, {
      target: body.target as CommentTarget,
      targetRef: body.targetRef ?? null,
      audioIssue: body.audioIssue,
      body: body.body,
    });
  }

  @Post('comments/:id/resolve')
  @ApiOperation({ summary: 'Marca o comentário como resolvido' })
  async resolveComment(
    @Param('id') id: string,
    @ActiveUserId() userId: string,
  ) {
    return this.review.resolve(id, userId);
  }

  // --- Revisão de áudio ---

  @Get('lesson-versions/:id/audio')
  @ApiOperation({
    summary: 'Cada fala, questão de escuta e nota, com o áudio e os problemas',
  })
  async listAudio(@Param('id') id: string) {
    return this.audio.list(id);
  }

  @Post('lesson-versions/:id/audio/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Gera de novo o áudio das falas escolhidas' })
  async regenerateAudio(
    @Param('id') id: string,
    @Body() body: RegenerateAudioDto,
  ) {
    return this.audio.regenerate(id, body.keys, body.speakingRate);
  }

  // --- Produção de mídia ---

  @Post('lesson-versions/:id/tts')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Gera a narração à mão (normalmente roda sozinha na aprovação)',
  })
  async generateAudio(@Param('id') id: string) {
    const job = await this.media.add(TTS_GENERATE_JOB, {
      lessonVersionId: id,
    });

    return { jobId: job.id ?? null, queue: QUEUES.MEDIA };
  }

  @Get('workbooks')
  @ApiOperation({
    summary: 'Apostila de cada unidade: em dia ou desatualizada',
  })
  async listWorkbooks() {
    return this.workbooks.listForAdmin();
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Estado de um job da fila de mídia' })
  async mediaJob(@Param('id') id: string) {
    const job = await this.media.getJob(id);

    if (job === undefined) {
      // Job concluído é removido pela limpeza da fila: some, não falha.
      return { id, state: 'unknown' as const, failedReason: null };
    }

    const state = await job.getState();

    return {
      id,
      state:
        state === 'active' || state === 'completed' || state === 'failed'
          ? state
          : state === 'unknown'
            ? ('unknown' as const)
            : ('waiting' as const),
      failedReason: job.failedReason ?? null,
    };
  }

  @Post('units/:id/workbook')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Gera a apostila em PDF (normalmente roda após o publish)',
  })
  async generateWorkbook(@Param('id') id: string) {
    const job = await this.media.add(WORKBOOK_PDF_JOB, { unitId: id });

    return { jobId: job.id ?? null, queue: QUEUES.MEDIA };
  }
}
