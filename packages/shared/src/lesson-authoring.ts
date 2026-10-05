import { z } from 'zod';

import { cefrLevelSchema } from './cefr';
import { taxonomySlugSchema } from './curriculum';

/**
 * Metadados editáveis de uma versão de lição — os limites que a API aplica
 * em `PUT lesson-versions/:id` e que o editor confere ao vivo.
 */
export const lessonVersionMetaSchema = z.object({
  title: z.string().trim().min(2).max(160),
  /** Can-do em pt-BR. */
  objective: z.string().trim().min(4).max(500),
  cefrLevel: cefrLevelSchema,
  estimatedMinutes: z.number().int().min(1).max(180),
  targetSkillIds: z.array(taxonomySlugSchema).max(20),
});

export type LessonVersionMeta = z.infer<typeof lessonVersionMetaSchema>;

/** Na API todo campo é opcional: o `PUT` só manda o que mudou. */
export const lessonVersionMetaPatchSchema = lessonVersionMetaSchema.partial();

/** Tetos do rascunho tolerante (`PUT steps?draft=true`). */
export const DRAFT_MAX_STEPS = 40;
export const DRAFT_MAX_BYTES = 256 * 1024;
