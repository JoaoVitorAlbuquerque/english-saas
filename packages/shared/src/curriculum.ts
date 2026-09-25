import { z } from 'zod';

import { cefrLevelSchema, type CefrLevel } from './cefr';
import { competencySchema } from './competency';
import { learningGoalSchema } from './user';

/**
 * Taxonomia do conteúdo: Skill, ErrorPattern e RegisterNote.
 *
 * O id dessas três é um **slug imutável**. Ele viaja dentro do JSON das
 * etapas de lição, do `errorPatternMap` dos itens, dos prompts de IA e do
 * modelo do aluno — renomear quebraria conteúdo já publicado. Para trocar,
 * marque `deprecatedAt` e aponte `replacedById` para o substituto.
 */

/** Slug de taxonomia: `grammar.be.present.affirmative`, `l1.have-for-age`. */
export const TAXONOMY_SLUG_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const taxonomySlugSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(
    TAXONOMY_SLUG_PATTERN,
    'Use minúsculas, números, ponto e hífen (ex.: grammar.be.present).',
  );

/** Slug de conteúdo: `nice-to-meet-you`, `a1-u1-new-neighbors`. */
export const CONTENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const contentSlugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(
    CONTENT_SLUG_PATTERN,
    'Use minúsculas, números e hífen (ex.: nice-to-meet-you).',
  );

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SKILL_TYPES = [
  'GRAMMAR',
  'VOCAB_SET',
  'CHUNK',
  'FUNCTION',
  'PRONUNCIATION',
  'REGISTER',
] as const;
export const skillTypeSchema = z.enum(SKILL_TYPES);
export type SkillType = z.infer<typeof skillTypeSchema>;

export const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  GRAMMAR: 'Estrutura gramatical',
  VOCAB_SET: 'Conjunto de vocabulário',
  CHUNK: 'Expressão pronta',
  FUNCTION: 'Função comunicativa',
  PRONUNCIATION: 'Pronúncia',
  REGISTER: 'Registro falado',
};

export const REGISTER_LEVELS = [
  'INFORMAL_SPOKEN',
  'NEUTRAL',
  'FORMAL',
] as const;
export const registerLevelSchema = z.enum(REGISTER_LEVELS);
export type RegisterLevel = z.infer<typeof registerLevelSchema>;

export const REGISTER_LEVEL_LABELS: Record<RegisterLevel, string> = {
  INFORMAL_SPOKEN: 'Fala do dia a dia',
  NEUTRAL: 'Neutro',
  FORMAL: 'Formal',
};

/**
 * Ciclo de vida de tudo que é autorado.
 *
 * `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`, e `ARCHIVED` no fim da vida.
 * Editar uma versão em IN_REVIEW ou APPROVED devolve ela para DRAFT: o que
 * foi revisado deixou de ser o que está ali.
 */
export const CONTENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export const contentStatusSchema = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Rascunho',
  IN_REVIEW: 'Em revisão',
  APPROVED: 'Aprovado',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado',
};

export const MEDIA_KINDS = ['AUDIO', 'IMAGE', 'PDF'] as const;
export const mediaKindSchema = z.enum(MEDIA_KINDS);
export type MediaKind = z.infer<typeof mediaKindSchema>;

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export const skillSchema = z.object({
  id: taxonomySlugSchema,
  type: skillTypeSchema,
  competency: competencySchema,
  cefrLevel: cefrLevelSchema,
  title: z.string().min(2).max(160),
  description: z.string().max(1_000).nullable(),
  prerequisites: z.array(taxonomySlugSchema),
  commonErrors: z.array(taxonomySlugSchema),
  /** Objetivos a que a skill serve. Vazio = todos igualmente. */
  goals: z.array(learningGoalSchema),
  deprecatedAt: z.string().nullable(),
  replacedById: taxonomySlugSchema.nullable(),
});

export type Skill = z.infer<typeof skillSchema>;

// ---------------------------------------------------------------------------
// ErrorPattern
// ---------------------------------------------------------------------------

export const errorPatternSchema = z.object({
  id: taxonomySlugSchema,
  /** pt-BR: o que o aluno faz de errado. */
  description: z.string().min(4).max(500),
  /** A forma errada, em inglês: "I have 20 years." */
  example: z.string().min(1).max(500),
  /** A forma certa: "I'm 20 years old." */
  correction: z.string().min(1).max(500),
  /** pt-BR: por que acontece e como lembrar. */
  explanation: z.string().min(4).max(2_000),
  skillIds: z.array(taxonomySlugSchema),
  deprecatedAt: z.string().nullable(),
  replacedById: taxonomySlugSchema.nullable(),
});

export type ErrorPattern = z.infer<typeof errorPatternSchema>;

// ---------------------------------------------------------------------------
// RegisterNote
// ---------------------------------------------------------------------------

export const registerNoteSchema = z.object({
  id: taxonomySlugSchema,
  /** Como se fala: "gonna", "You coming?" */
  spokenForm: z.string().min(1).max(300),
  /** A estrutura completa: "going to", "Are you coming?" */
  standardForm: z.string().min(1).max(300),
  register: registerLevelSchema,
  /** pt-BR: o que muda e quando usar. */
  explanation: z.string().min(4).max(2_000),
  /** pt-BR: onde não cabe. "Não use em e-mail formal." */
  whenToAvoid: z.string().max(500).nullable(),
  cefrLevel: cefrLevelSchema,
  skillId: taxonomySlugSchema.nullable(),
  deprecatedAt: z.string().nullable(),
  replacedById: taxonomySlugSchema.nullable(),
});

export type RegisterNote = z.infer<typeof registerNoteSchema>;

// ---------------------------------------------------------------------------
// Dificuldade
// ---------------------------------------------------------------------------

/**
 * Dificuldade inicial de um item, em logit, derivada do nível CEFR.
 * A calibração real vem das tentativas dos alunos (módulo 8).
 */
export const INITIAL_DIFFICULTY_BY_LEVEL: Record<CefrLevel, number> = {
  A1: -2,
  A2: -1,
  B1: 0,
  B2: 1,
  C1: 2,
};

/** Limites da escala. Fora disso o item não discrimina mais nada. */
export const MIN_DIFFICULTY = -4;
export const MAX_DIFFICULTY = 4;
