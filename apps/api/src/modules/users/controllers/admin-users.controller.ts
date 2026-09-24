import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@english-saas/shared';

import { Roles } from 'src/common/decorators/roles.decorator';
import { CursorPaginationQueryDto } from 'src/common/pagination/cursor-pagination.dto';

import { UsersService, type AdminUserRow } from '../services/users.service';

/**
 * Listagem de alunos para o painel interno.
 *
 * Restrita a ADMIN pelo `@Roles` — o painel completo vem no módulo 17.
 */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista alunos, paginado por cursor' })
  async list(
    @Query() query: CursorPaginationQueryDto,
  ): Promise<Paginated<AdminUserRow>> {
    return this.users.listForAdmin(query);
  }
}
