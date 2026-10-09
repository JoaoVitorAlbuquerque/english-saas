import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditService } from 'src/infra/audit/audit.service';
import { UsersService } from 'src/modules/users/services/users.service';

import { AuditLogQueryDto } from '../dto/admin.dto';

/** Log de auditoria das ações de ADMIN. Só leitura — ninguém edita nem apaga. */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/audit-log')
export class AdminAuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Ações de admin, mais recente primeiro' })
  async list(@Query() query: AuditLogQueryDto) {
    const page = await this.audit.list(
      {
        action: query.action,
        actorId: query.actorId,
        targetId: query.targetId,
        from: query.from === undefined ? undefined : new Date(query.from),
        to: query.to === undefined ? undefined : new Date(query.to),
      },
      query,
    );

    // O alvo `user` vira o e-mail de hoje (anonimizado, se a conta foi
    // anonimizada): a auditoria guarda só o id, sem copiar dado pessoal.
    const emails = await this.users.emailsFor(
      page.data.flatMap((entry) =>
        entry.targetType === 'user' && entry.targetId !== null
          ? [entry.targetId]
          : [],
      ),
    );

    return {
      ...page,
      data: page.data.map((entry) => ({
        ...entry,
        targetLabel:
          entry.targetType === 'user' && entry.targetId !== null
            ? (emails.get(entry.targetId) ?? null)
            : null,
      })),
    };
  }
}
