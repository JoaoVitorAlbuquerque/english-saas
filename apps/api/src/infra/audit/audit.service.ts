import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AuditAction,
  AuditTargetType,
  Paginated,
} from '@english-saas/shared';

import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export type AuditActor = { id: string; email: string };

export type AuditEntryInput = {
  actor: AuditActor;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  /** Campos alterados, motivo, números. Nunca conteúdo do aluno. */
  details?: Prisma.InputJsonObject;
  requestId?: string | undefined;
};

export type AuditEntry = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: unknown;
  requestId: string | null;
  createdAt: Date;
};

export type AuditFilter = {
  action?: string | undefined;
  actorId?: string | undefined;
  targetId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
};

/**
 * Trilha de auditoria das ações de ADMIN. Append-only.
 *
 * `record` é chamado pelo controller **depois** do sucesso da ação (só ele
 * tem o "antes" do diff). A gravação é best-effort: se falhar, vira log de
 * erro e a ação — que já aconteceu — não é desfeita nem escondida do admin.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditEntryInput): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: input.actor.id,
          actorEmail: input.actor.email,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          details: input.details ?? {},
          requestId: input.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        { err: error, action: input.action, requestId: input.requestId },
        'Falha ao gravar a auditoria',
      );
    }
  }

  async list(
    filter: AuditFilter,
    page: { cursor?: string | undefined; limit: number },
  ): Promise<Paginated<AuditEntry>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(page);

    const rows = await this.prisma.adminAuditLog.findMany({
      take,
      ...cursorArgs,
      where: {
        ...(filter.action === undefined ? {} : { action: filter.action }),
        ...(filter.actorId === undefined ? {} : { actorId: filter.actorId }),
        ...(filter.targetId === undefined ? {} : { targetId: filter.targetId }),
        ...(filter.from === undefined && filter.to === undefined
          ? {}
          : {
              createdAt: {
                ...(filter.from === undefined ? {} : { gte: filter.from }),
                ...(filter.to === undefined ? {} : { lte: filter.to }),
              },
            }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        actorId: true,
        actorEmail: true,
        action: true,
        targetType: true,
        targetId: true,
        details: true,
        requestId: true,
        createdAt: true,
      },
    });

    return buildPage(rows, page.limit, (row) => row.id);
  }
}
