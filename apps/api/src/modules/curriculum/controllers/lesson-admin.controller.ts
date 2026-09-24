import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';

import {
  CreateLessonDto,
  ReplaceStepsDto,
  UpdateLessonVersionDto,
} from '../dto/lesson.dto';
import { LessonAuthoringService } from '../services/lesson-authoring.service';

/**
 * Autoria de lição. Restrita a EDITOR e ADMIN.
 *
 * O fluxo é: criar a lição (nasce com a versão 1 em DRAFT) → escrever as
 * etapas → `submit-for-review` → `approve` → `publish`. Para mexer numa
 * lição já no ar, `POST /lessons/:id/versions` abre a próxima em DRAFT.
 */
@ApiTags('curriculum-admin')
@Roles('EDITOR', 'ADMIN')
@Controller('admin/curriculum')
export class LessonAdminController {
  constructor(private readonly lessons: LessonAuthoringService) {}

  @Get('lessons')
  @ApiOperation({ summary: 'Lições e o histórico de versões de cada uma' })
  async list(@Query('unitId') unitId?: string) {
    return this.lessons.listLessons(unitId);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Uma lição com todas as versões' })
  async find(@Param('id') id: string) {
    return this.lessons.findLesson(id);
  }

  @Post('lessons')
  @ApiOperation({ summary: 'Cria a lição já com a versão 1 em rascunho' })
  async create(@Body() body: CreateLessonDto) {
    return this.lessons.createLesson(body);
  }

  @Post('lessons/:id/versions')
  @ApiOperation({
    summary: 'Abre a próxima versão, clonando a publicada',
  })
  async createVersion(@Param('id') id: string) {
    return this.lessons.createDraftVersion(id);
  }

  @Get('lesson-versions/:id')
  @ApiOperation({ summary: 'Uma versão com as etapas' })
  async findVersion(@Param('id') id: string) {
    return this.lessons.findVersion(id);
  }

  @Put('lesson-versions/:id')
  @ApiOperation({
    summary: 'Edita os metadados da versão (derruba a revisão feita)',
  })
  async updateVersion(
    @Param('id') id: string,
    @Body() body: UpdateLessonVersionDto,
  ) {
    return this.lessons.updateVersion(id, body);
  }

  @Put('lesson-versions/:id/steps')
  @ApiOperation({ summary: 'Substitui as etapas inteiras, com validação' })
  async replaceSteps(@Param('id') id: string, @Body() body: ReplaceStepsDto) {
    return this.lessons.replaceSteps(id, body.steps);
  }

  @Post('lesson-versions/:id/submit-for-review')
  @ApiOperation({ summary: 'Manda o rascunho para revisão' })
  async submit(@Param('id') id: string) {
    return this.lessons.transition(id, 'submit');
  }

  @Post('lesson-versions/:id/approve')
  @ApiOperation({ summary: 'Aprova a revisão e registra quem aprovou' })
  async approve(@Param('id') id: string, @ActiveUserId() userId: string) {
    return this.lessons.transition(id, 'approve', userId);
  }

  @Post('lesson-versions/:id/reject')
  @ApiOperation({ summary: 'Devolve para rascunho' })
  async reject(@Param('id') id: string) {
    return this.lessons.transition(id, 'reject');
  }

  @Post('lesson-versions/:id/publish')
  @ApiOperation({
    summary: 'Publica: revalida tudo e passa a ser o que o aluno vê',
  })
  async publish(@Param('id') id: string) {
    return this.lessons.transition(id, 'publish');
  }

  @Post('lesson-versions/:id/archive')
  @ApiOperation({ summary: 'Arquiva a versão' })
  async archive(@Param('id') id: string) {
    return this.lessons.transition(id, 'archive');
  }
}
