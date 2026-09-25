import { cefrLevelSchema } from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
