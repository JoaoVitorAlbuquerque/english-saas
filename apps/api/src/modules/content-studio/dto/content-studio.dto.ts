import {
  cefrLevelSchema,
  contentSlugSchema,
  cursorPaginationQuerySchema,
  taxonomySlugSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DRAFTABLE_ITEM_TYPES } from 'src/modules/ai/prompts/draft-shared';

/** Entrada do content-studio. */

export class RequestLessonDraftDto extends createZodDto(
  z
    .object({
      /** Lição que já existe. Sem ela, informe unidade, slug e posição. */
      lessonId: z.uuid().optional(),
      unitId: z.uuid().optional(),
      slug: contentSlugSchema.optional(),
      order: z.number().int().min(0).optional(),
      title: z.string().trim().min(2).max(160).optional(),

      /** Can-do em pt-BR. */
      objective: z.string().trim().min(4).max(300),
      level: cefrLevelSchema,
      targetSkillIds: z.array(taxonomySlugSchema).min(1).max(8),
      characterIds: z.array(z.uuid()).min(1).max(6),
      /** O que já aconteceu na série, para a cena ter continuidade. */
      unitContext: z.string().trim().max(2_000).optional(),
    })
    .refine(
      (body) =>
        body.lessonId !== undefined ||
        (body.unitId !== undefined &&
          body.slug !== undefined &&
          body.order !== undefined),
      {
        message:
          'Informe `lessonId`, ou `unitId` + `slug` + `order` para criar a lição.',
        path: ['lessonId'],
      },
    ),
) {}

export class RequestItemsDraftDto extends createZodDto(
  z.object({
    skillId: taxonomySlugSchema,
    level: cefrLevelSchema,
    count: z.number().int().min(1).max(20),
    types: z
      .array(z.enum(DRAFTABLE_ITEM_TYPES))
      .min(1)
      .default(['MULTIPLE_CHOICE', 'FILL_BLANK', 'ORDER_WORDS']),
  }),
) {}

export class RequestRegisterNotesDraftDto extends createZodDto(
  z.object({
    level: cefrLevelSchema,
    count: z.number().int().min(1).max(15),
  }),
) {}

export class DraftListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    status: z
      .enum([
        'QUEUED',
        'GENERATING',
        'QA_RUNNING',
        'READY',
        'FAILED',
        'DISCARDED',
      ])
      .optional(),
    kind: z.enum(['LESSON', 'ITEMS', 'REGISTER_NOTES']).optional(),
  }),
) {}

export class CreateCommentDto extends createZodDto(
  z.object({
    target: z.enum(['VERSION', 'STEP', 'ITEM']).default('VERSION'),
    /** Ordem da etapa ou id da questão, conforme o `target`. */
    targetRef: z.string().trim().max(120).nullable().optional(),
    body: z.string().trim().min(1).max(2_000),
  }),
) {}

export class CommentListQueryDto extends createZodDto(
  z.object({
    includeResolved: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  }),
) {}
