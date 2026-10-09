import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cursorPaginationQuerySchema,
  type Paginated,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Roles } from 'src/common/decorators/roles.decorator';

import { UsersService, type AdminUserRow } from '../services/users.service';

export class AdminUsersQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    /** Trecho do nome ou do e-mail. */
    q: z.string().trim().max(120).optional(),
  }),
) {}

/**
 * Listagem de alunos para o painel interno.
 *
 * Restrita a ADMIN pelo `@Roles`. A ficha completa do aluno (nível, plano,
 * créditos…) mora no módulo `admin`, que pode importar os outros.
 */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista alunos (mais novo primeiro), com busca por nome ou e-mail',
  })
  async list(
    @Query() query: AdminUsersQueryDto,
  ): Promise<Paginated<AdminUserRow>> {
    return this.users.listForAdmin(query);
  }
}
