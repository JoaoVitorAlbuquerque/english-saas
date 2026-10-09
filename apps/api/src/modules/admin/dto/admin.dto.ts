import {
  auditActionSchema,
  cursorPaginationQuerySchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class AuditLogQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    action: auditActionSchema.optional(),
    actorId: z.uuid().optional(),
    /** Id do alvo (aluno, plano…). Texto: o alvo de custo é o nome da feature. */
    targetId: z.string().min(1).max(80).optional(),
    /** Instantes ISO: o painel manda os limites do dia no fuso de quem olha. */
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  }),
) {}

export class StudentAiUsageQueryDto extends createZodDto(
  z.object({
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  }),
) {}
