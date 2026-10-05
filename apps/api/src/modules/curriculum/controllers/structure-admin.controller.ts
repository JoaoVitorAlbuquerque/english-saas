import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MediaKind } from '@prisma/client';

import { Roles } from 'src/common/decorators/roles.decorator';

import {
  ContentActionDto,
  CreateCharacterDto,
  CreateCourseDto,
  CreateLevelDto,
  CreateUnitDto,
  CreateWorkbookDto,
  RegisterMediaAssetDto,
  ReorderUnitsDto,
  UpdateCharacterDto,
  UpdateLevelDto,
  UpdateUnitDto,
} from '../dto/structure.dto';
import { IMAGE_MAX_BYTES } from '../domain/image-upload';
import { StructureService } from '../services/structure.service';

/** Autoria da estrutura do curso. Restrita a EDITOR e ADMIN. */
@ApiTags('curriculum-admin')
@Roles('EDITOR', 'ADMIN')
@Controller('admin/curriculum')
export class StructureAdminController {
  constructor(private readonly structure: StructureService) {}

  // --- Curso e nível ---

  @Get('courses')
  @ApiOperation({ summary: 'Cursos e seus níveis' })
  async listCourses() {
    return this.structure.listCourses();
  }

  @Post('courses')
  @ApiOperation({ summary: 'Cria um curso' })
  async createCourse(@Body() body: CreateCourseDto) {
    return this.structure.createCourse(body);
  }

  @Post('levels')
  @ApiOperation({ summary: 'Cria um nível dentro do curso' })
  async createLevel(@Body() body: CreateLevelDto) {
    return this.structure.createLevel(body);
  }

  @Patch('levels/:id')
  @ApiOperation({ summary: 'Edita um nível e seus can-dos' })
  async updateLevel(@Param('id') id: string, @Body() body: UpdateLevelDto) {
    return this.structure.updateLevel(id, body);
  }

  // --- Unidade ---

  @Get('units')
  @ApiOperation({ summary: 'Unidades, inclusive as não publicadas' })
  async listUnits(@Query('levelId') levelId?: string) {
    return this.structure.listUnits(levelId);
  }

  @Get('units/:id')
  @ApiOperation({ summary: 'Uma unidade com elenco, lições e apostilas' })
  async findUnit(@Param('id') id: string) {
    return this.structure.findUnit(id);
  }

  @Post('units')
  @ApiOperation({ summary: 'Cria uma unidade (episódio)' })
  async createUnit(@Body() body: CreateUnitDto) {
    return this.structure.createUnit(body);
  }

  @Post('units/reorder')
  @ApiOperation({
    summary: 'Reordena as unidades de um nível (todas, na ordem nova)',
  })
  async reorderUnits(@Body() body: ReorderUnitsDto) {
    return this.structure.reorderUnits(body.levelId, body.ids);
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'Edita a unidade e o elenco' })
  async updateUnit(@Param('id') id: string, @Body() body: UpdateUnitDto) {
    return this.structure.updateUnit(id, body);
  }

  @Post('units/:id/transition')
  @ApiOperation({ summary: 'Move a unidade no fluxo editorial' })
  async transitionUnit(
    @Param('id') id: string,
    @Body() body: ContentActionDto,
  ) {
    return this.structure.transitionUnit(id, body.action);
  }

  // --- Personagem ---

  @Get('characters')
  @ApiOperation({ summary: 'Elenco fixo' })
  async listCharacters() {
    return this.structure.listCharacters();
  }

  @Post('characters')
  @ApiOperation({ summary: 'Cria um personagem' })
  async createCharacter(@Body() body: CreateCharacterDto) {
    return this.structure.createCharacter(body);
  }

  @Patch('characters/:id')
  @ApiOperation({ summary: 'Edita um personagem' })
  async updateCharacter(
    @Param('id') id: string,
    @Body() body: UpdateCharacterDto,
  ) {
    return this.structure.updateCharacter(id, body);
  }

  // --- Mídia ---

  @Get('media-assets')
  @ApiOperation({ summary: 'Mídia registrada' })
  async listMediaAssets(@Query('kind') kind?: MediaKind) {
    return this.structure.listMediaAssets(kind);
  }

  @Post('media-assets')
  @ApiOperation({
    summary: 'Registra um objeto que já está no bucket, sob content/',
  })
  async registerMediaAsset(@Body() body: RegisterMediaAssetDto) {
    return this.structure.registerMediaAsset(body);
  }

  @Post('media-assets/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_BYTES } }),
  )
  @ApiOperation({
    summary: 'Envia uma imagem (JPEG, PNG ou WebP até 2 MB) e registra o asset',
  })
  async uploadImage(@UploadedFile() file: { buffer: Buffer } | undefined) {
    return this.structure.uploadImage(file);
  }

  // --- Apostila ---

  @Post('workbooks')
  @ApiOperation({ summary: 'Cria a apostila em PDF de uma unidade' })
  async createWorkbook(@Body() body: CreateWorkbookDto) {
    return this.structure.createWorkbook(body);
  }

  @Post('workbooks/:id/transition')
  @ApiOperation({ summary: 'Move a apostila no fluxo editorial' })
  async transitionWorkbook(
    @Param('id') id: string,
    @Body() body: ContentActionDto,
  ) {
    return this.structure.transitionWorkbook(id, body.action);
  }
}
