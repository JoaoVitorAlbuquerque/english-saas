import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CatalogLevelQueryDto,
  CatalogRegisterNoteQueryDto,
  CatalogSkillQueryDto,
  CatalogUnitQueryDto,
} from '../dto/catalog.dto';
import { CatalogService } from '../services/catalog.service';

/**
 * O catálogo do aluno.
 *
 * Tudo aqui exige login (o `JwtAuthGuard` é global) mas não exige papel:
 * conteúdo base é igual para todo mundo e todo liberado — ver CLAUDE.md,
 * "Regras de produto". Só sai o que está PUBLISHED, e sem gabarito.
 */
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('levels')
  @ApiOperation({ summary: 'Níveis do curso, com os can-dos de cada um' })
  async levels() {
    return this.catalog.listLevels();
  }

  @Get('units')
  @ApiOperation({ summary: 'Unidades publicadas, paginado por cursor' })
  async units(@Query() query: CatalogUnitQueryDto) {
    return this.catalog.listUnits(query);
  }

  @Get('units/:slug')
  @ApiOperation({ summary: 'Uma unidade com elenco e lições publicadas' })
  async unit(@Param('slug') slug: string) {
    return this.catalog.findUnitBySlug(slug);
  }

  @Get('lessons/:slug')
  @ApiOperation({
    summary: 'Lição publicada: etapas, personagens, itens e mídia assinada',
  })
  async lesson(@Param('slug') slug: string) {
    return this.catalog.findLessonBySlug(slug);
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
  @ApiOperation({ summary: 'Apostilas em PDF, com URL assinada' })
  async workbooks(@Query() query: CatalogLevelQueryDto) {
    return this.catalog.listWorkbooks(query);
  }
}
