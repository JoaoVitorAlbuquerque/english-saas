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
  CreateItemDto,
  ItemListQueryDto,
  UpdateItemDto,
} from '../dto/item.dto';
import { ItemService } from '../services/item.service';

/**
 * Autoria de questão. Restrita a EDITOR e ADMIN.
 *
 * Item publicado é imutável no enunciado: `PATCH` recusa a mudança e
 * `POST /items/:id/revisions` cria a próxima versão dele.
 */
@ApiTags('curriculum-admin')
@Roles('EDITOR', 'ADMIN')
@Controller('admin/curriculum/items')
export class ItemAdminController {
  constructor(private readonly items: ItemService) {}

  @Get()
  @ApiOperation({ summary: 'Banco de questões, paginado por cursor' })
  async list(@Query() query: ItemListQueryDto) {
    return this.items.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Uma questão, com gabarito, áudio e as lições que a usam',
  })
  async find(@Param('id') id: string) {
    return this.items.findForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma questão em rascunho' })
  async create(@Body() body: CreateItemDto) {
    return this.items.withAdminExtras(await this.items.create(body));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita. Recusa mexer no enunciado de questão publicada',
  })
  async update(@Param('id') id: string, @Body() body: UpdateItemDto) {
    return this.items.withAdminExtras(await this.items.update(id, body));
  }

  @Post(':id/revisions')
  @ApiOperation({
    summary: 'Cria a próxima versão da questão, ligada a esta',
  })
  async createRevision(@Param('id') id: string, @Body() body: UpdateItemDto) {
    return this.items.withAdminExtras(
      await this.items.createRevision(id, body),
    );
  }

  @Post(':id/submit-for-review')
  @ApiOperation({ summary: 'Manda a questão para revisão' })
  async submit(@Param('id') id: string) {
    return this.items.withAdminExtras(
      await this.items.transition(id, 'submit'),
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprova a questão' })
  async approve(@Param('id') id: string) {
    return this.items.withAdminExtras(
      await this.items.transition(id, 'approve'),
    );
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Devolve a questão em revisão ou aprovada a rascunho',
  })
  async reject(@Param('id') id: string) {
    return this.items.withAdminExtras(
      await this.items.transition(id, 'reject'),
    );
  }

  @Post(':id/publish')
  @ApiOperation({
    summary: 'Publica e aposenta a questão que esta substitui',
  })
  async publish(@Param('id') id: string) {
    return this.items.withAdminExtras(
      await this.items.transition(id, 'publish'),
    );
  }

  @Post(':id/archive')
  @ApiOperation({
    summary: 'Arquiva. Recusa se a questão está numa lição no ar',
  })
  async archive(@Param('id') id: string) {
    return this.items.withAdminExtras(
      await this.items.transition(id, 'archive'),
    );
  }
}
