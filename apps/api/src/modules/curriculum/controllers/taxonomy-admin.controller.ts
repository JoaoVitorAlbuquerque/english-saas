import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from 'src/common/decorators/roles.decorator';

import {
  CreateErrorPatternDto,
  CreateRegisterNoteDto,
  CreateSkillDto,
  DeprecateDto,
  ErrorPatternListQueryDto,
  RegisterNoteListQueryDto,
  SkillListQueryDto,
  UpdateErrorPatternDto,
  UpdateRegisterNoteDto,
  UpdateSkillDto,
} from '../dto/taxonomy.dto';
import { TaxonomyService } from '../services/taxonomy.service';

/**
 * Autoria da taxonomia. Restrita a EDITOR e ADMIN.
 *
 * Não existe DELETE: slug de taxonomia é referenciado por conteúdo
 * publicado e pelo modelo do aluno. O que existe é depreciar.
 */
@ApiTags('curriculum-admin')
@Roles('EDITOR', 'ADMIN')
@Controller('admin/curriculum')
export class TaxonomyAdminController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  // --- Skill ---

  @Get('skills')
  @ApiOperation({
    summary: 'Lista skills, com filtro por nível, competência, tipo e busca',
  })
  async listSkills(@Query() query: SkillListQueryDto) {
    return this.taxonomy.listSkills(query);
  }

  @Get('skills/:id')
  @ApiOperation({ summary: 'Uma skill com pré-requisitos e erros comuns' })
  async findSkill(@Param('id') id: string) {
    return this.taxonomy.findSkill(id);
  }

  @Post('skills')
  @ApiOperation({ summary: 'Cria uma skill' })
  async createSkill(@Body() body: CreateSkillDto) {
    return this.taxonomy.createSkill(body);
  }

  @Patch('skills/:id')
  @ApiOperation({ summary: 'Edita uma skill (o id nunca muda)' })
  async updateSkill(@Param('id') id: string, @Body() body: UpdateSkillDto) {
    return this.taxonomy.updateSkill(id, body);
  }

  @Post('skills/:id/deprecate')
  @ApiOperation({ summary: 'Tira de circulação e aponta o substituto' })
  async deprecateSkill(@Param('id') id: string, @Body() body: DeprecateDto) {
    return this.taxonomy.deprecateSkill(id, body.replacedById ?? null);
  }

  // --- ErrorPattern ---

  @Get('error-patterns')
  @ApiOperation({ summary: 'Lista os erros típicos catalogados' })
  async listErrorPatterns(@Query() query: ErrorPatternListQueryDto) {
    return this.taxonomy.listErrorPatterns(query);
  }

  @Get('error-patterns/:id')
  @ApiOperation({ summary: 'Um erro típico e as skills que ele afeta' })
  async findErrorPattern(@Param('id') id: string) {
    return this.taxonomy.findErrorPattern(id);
  }

  @Post('error-patterns')
  @ApiOperation({ summary: 'Cataloga um erro típico' })
  async createErrorPattern(@Body() body: CreateErrorPatternDto) {
    return this.taxonomy.createErrorPattern(body);
  }

  @Patch('error-patterns/:id')
  @ApiOperation({ summary: 'Edita um erro típico (o id nunca muda)' })
  async updateErrorPattern(
    @Param('id') id: string,
    @Body() body: UpdateErrorPatternDto,
  ) {
    return this.taxonomy.updateErrorPattern(id, body);
  }

  @Post('error-patterns/:id/deprecate')
  @ApiOperation({ summary: 'Tira de circulação e aponta o substituto' })
  async deprecateErrorPattern(
    @Param('id') id: string,
    @Body() body: DeprecateDto,
  ) {
    return this.taxonomy.deprecateErrorPattern(id, body.replacedById ?? null);
  }

  // --- RegisterNote ---

  @Get('register-notes')
  @ApiOperation({ summary: 'Lista as notas de registro falado' })
  async listRegisterNotes(@Query() query: RegisterNoteListQueryDto) {
    return this.taxonomy.listRegisterNotes(query);
  }

  @Get('register-notes/:id')
  @ApiOperation({ summary: 'Uma nota de registro' })
  async findRegisterNote(@Param('id') id: string) {
    return this.taxonomy.findRegisterNote(id);
  }

  @Post('register-notes')
  @ApiOperation({ summary: 'Cria uma nota de registro' })
  async createRegisterNote(@Body() body: CreateRegisterNoteDto) {
    return this.taxonomy.createRegisterNote(body);
  }

  @Patch('register-notes/:id')
  @ApiOperation({ summary: 'Edita uma nota de registro (o id nunca muda)' })
  async updateRegisterNote(
    @Param('id') id: string,
    @Body() body: UpdateRegisterNoteDto,
  ) {
    return this.taxonomy.updateRegisterNote(id, body);
  }

  @Post('register-notes/:id/deprecate')
  @ApiOperation({ summary: 'Tira de circulação e aponta o substituto' })
  async deprecateRegisterNote(
    @Param('id') id: string,
    @Body() body: DeprecateDto,
  ) {
    return this.taxonomy.deprecateRegisterNote(id, body.replacedById ?? null);
  }
}
