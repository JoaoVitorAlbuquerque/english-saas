import {
  cefrLevelSchema,
  contentSlugSchema,
  lessonVersionMetaPatchSchema,
  lessonStepTypeSchema,
  taxonomySlugSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Entrada da autoria de lição. */

export class CreateLessonDto extends createZodDto(
  z.object({
    unitId: z.uuid(),
    slug: contentSlugSchema,
    order: z.number().int().min(0),
    title: z.string().trim().min(2).max(160),
    /** Can-do em pt-BR. */
    objective: z.string().trim().min(4).max(500),
    cefrLevel: cefrLevelSchema,
    estimatedMinutes: z.number().int().min(1).max(180).optional(),
    targetSkillIds: z.array(taxonomySlugSchema).max(20).optional(),
  }),
) {}

export class UpdateLessonVersionDto extends createZodDto(
  lessonVersionMetaPatchSchema,
) {}

/**
 * Substitui as etapas inteiras.
 *
 * O `content` entra como `unknown` de propósito: quem valida é
 * `domain/step-content.ts`, que confere o schema do tipo **e** as marcações
 * contra o texto, e devolve todos os problemas de uma vez. O pipe global
 * pararia no primeiro, e o editor merece a lista inteira.
 */
export class ReplaceStepsDto extends createZodDto(
  z.object({
    steps: z
      .array(
        z.object({
          order: z.number().int().min(0).max(100),
          type: lessonStepTypeSchema,
          content: z.unknown(),
        }),
      )
      .max(40),
  }),
) {}

export class ReorderLessonsDto extends createZodDto(
  z.object({
    unitId: z.uuid(),
    /** As lições da unidade, todas, na ordem nova. */
    ids: z.array(z.uuid()).min(1).max(200),
  }),
) {}
