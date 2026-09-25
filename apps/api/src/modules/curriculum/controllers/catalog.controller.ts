import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';

import {
  CatalogLevelQueryDto,
  CatalogRegisterNoteQueryDto,
  CatalogSkillQueryDto,
  CatalogUnitQueryDto,
} from '../dto/catalog.dto';
import { CatalogAccessService } from '../services/catalog-access.service';
import { CatalogService } from '../services/catalog.service';

/**
 * O catálogo do aluno.
 *
 * Tudo aqui exige login (o `JwtAuthGuard` é global) mas não exige papel.
 * O conteúdo base é igual para todo mundo e liberado em qualquer ordem —
 * nada trava por progresso. O que o **plano** não inclui aparece na
 * listagem com `locked` e `requiredPlan`, e abrir a lição ou baixar a
 * apostila dá 403 `PLAN_REQUIRED` (quem decide é a `AccessPolicy`).
 * Só sai o que está PUBLISHED, e sem gabarito.
 */
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly access: CatalogAccessService,
  ) {}

  @Get('levels')
  @ApiOperation({ summary: 'Níveis do curso, com os can-dos de cada um' })
  async levels() {
    return this.catalog.listLevels();
  }

  @Get('units')
  @ApiOperation({ summary: 'Unidades publicadas, paginado por cursor' })
  async units(
    @ActiveUserId() userId: string,
    @Query() query: CatalogUnitQueryDto,
  ) {
    return this.access.units(userId, query);
  }

  @Get('units/:slug')
  @ApiOperation({ summary: 'Uma unidade com elenco e lições publicadas' })
  async unit(@ActiveUserId() userId: string, @Param('slug') slug: string) {
    return this.access.unit(userId, slug);
  }

  @Get('lessons/:slug')
  @ApiOperation({
    summary: 'Lição publicada: etapas, personagens, itens e mídia assinada',
  })
  async lesson(@ActiveUserId() userId: string, @Param('slug') slug: string) {
    return this.access.lesson(userId, slug);
  }

  @Get('skills')
  @ApiOperation({ summary: 'Skills em circulação' })
  async skills(@Query() query: CatalogSkillQueryDto) {
    return this.catalog.listSkills(query);
  }

  @Get('register-notes')
  @ApiOperation({ summary: 'Como se fala × estrutura gramatical' })
  async registerNotes(@Query() query: CatalogRegisterNoteQueryDto) {
    return this.catalog.listRegisterNotes(query);
  }

  @Get('characters')
  @ApiOperation({ summary: 'Elenco fixo da série' })
  async characters() {
    return this.catalog.listCharacters();
  }

  @Get('workbooks')
  @ApiOperation({
    summary: 'Apostilas em PDF; as fora do plano vêm com locked e sem link',
  })
  async workbooks(
    @ActiveUserId() userId: string,
    @Query() query: CatalogLevelQueryDto,
  ) {
    return this.access.workbooks(userId, query);
  }

  @Get('workbooks/:id/file')
  @ApiOperation({ summary: 'Link assinado do PDF de uma apostila' })
  async workbookFile(
    @ActiveUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.access.workbookFile(userId, id);
  }
}
