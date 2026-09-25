import {
  competencySchema,
  cursorPaginationQuerySchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';

export class LearnerSkillsQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    competency: competencySchema.optional(),
  }),
) {}
