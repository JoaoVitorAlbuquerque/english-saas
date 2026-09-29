import { cefrLevelSchema } from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AGENDA_SKIP_REASONS } from '../domain/build-agenda';

export class RebuildPlanDto extends createZodDto(
  z.object({
    targetLevel: cefrLevelSchema.optional(),
  }),
) {}

export class AgendaQueryDto extends createZodDto(
  z.object({
    /** Se vier, precisa ser o dia local de hoje — não existe agenda do passado. */
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
) {}

export class SkipBlockDto extends createZodDto(
  z.object({
    reason: z.enum(AGENDA_SKIP_REASONS).optional(),
    /** Só faz sentido com `reason: 'OTHER'` — a UI só mostra o campo aí. */
    note: z.string().trim().min(1).max(280).optional(),
  }),
) {}

export class CompleteBlockDto extends createZodDto(
  z.object({
    minutesSpent: z
      .number()
      .int()
      .min(0)
      .max(4 * 60)
      .optional(),
  }),
) {}
