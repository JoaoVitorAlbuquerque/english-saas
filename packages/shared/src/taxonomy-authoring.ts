import { z } from 'zod';

import { cefrLevelSchema } from './cefr';
import { competencySchema } from './competency';
import {
  registerLevelSchema,
  skillTypeSchema,
  taxonomySlugSchema,
} from './curriculum';
import { learningGoalSchema } from './user';

/**
 * Campos editáveis da taxonomia — os limites que a API aplica em
 * `POST/PATCH skills | error-patterns | register-notes` e que os formulários
 * do admin conferem ao vivo.
 *
 * O `id` só existe na criação: slug de taxonomia não se renomeia (ver
 * `TaxonomyService`).
 */

export const skillAuthoringSchema = z.object({
  id: taxonomySlugSchema,
  type: skillTypeSchema,
  competency: competencySchema,
  cefrLevel: cefrLevelSchema,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1_000).nullable().optional(),
  prerequisites: z.array(taxonomySlugSchema).max(20).optional(),
  commonErrors: z.array(taxonomySlugSchema).max(20).optional(),
  goals: z.array(learningGoalSchema).max(7).optional(),
});
export type SkillAuthoring = z.infer<typeof skillAuthoringSchema>;

/** No `PATCH` todo campo é opcional e o `id` não vai. */
export const skillAuthoringPatchSchema = skillAuthoringSchema
  .omit({ id: true })
  .partial();

export const errorPatternAuthoringSchema = z.object({
  id: taxonomySlugSchema,
  /** pt-BR: o que o aluno faz de errado. */
  description: z.string().trim().min(4).max(500),
  /** A forma errada, em inglês. */
  example: z.string().trim().min(1).max(500),
  /** A forma certa. */
  correction: z.string().trim().min(1).max(500),
  /** pt-BR: por que acontece e como lembrar. */
  explanation: z.string().trim().min(4).max(2_000),
  skillIds: z.array(taxonomySlugSchema).max(20).optional(),
});
export type ErrorPatternAuthoring = z.infer<typeof errorPatternAuthoringSchema>;

export const errorPatternAuthoringPatchSchema = errorPatternAuthoringSchema
  .omit({ id: true })
  .partial();

const registerNoteFields = {
  spokenForm: z.string().trim().min(1).max(300),
  standardForm: z.string().trim().min(1).max(300),
  register: registerLevelSchema,
  explanation: z.string().trim().min(4).max(2_000),
  whenToAvoid: z.string().trim().max(500).nullable().optional(),
  cefrLevel: cefrLevelSchema,
  skillId: taxonomySlugSchema.nullable().optional(),
  audioAssetId: z.uuid().nullable().optional(),
};

export const registerNoteAuthoringSchema = z.object({
  id: taxonomySlugSchema,
  ...registerNoteFields,
});
export type RegisterNoteAuthoring = z.infer<typeof registerNoteAuthoringSchema>;

export const registerNoteAuthoringPatchSchema = z
  .object(registerNoteFields)
  .partial();

/** Tirar de circulação: o substituto é opcional. */
export const deprecateSchema = z.object({
  replacedById: taxonomySlugSchema.nullable().optional(),
});
export type DeprecateInput = z.infer<typeof deprecateSchema>;
