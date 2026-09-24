import { z } from 'zod';

import { cefrLevelSchema } from './cefr';
import { taxonomySlugSchema } from './curriculum';

/**
 * Conteúdo das etapas de lição.
 *
 * Cada `LessonStep` guarda `type` + `content` (JSON). O schema abaixo é o
 * contrato desse JSON — é ele que o editor valida na gravação, o publish
 * revalida e o front usa para renderizar.
 *
 * Convenção de referência: cada campo aponta para a **chave primária** da
 * entidade. `characterId`, `audioAssetId` e `itemIds` são uuid; `skillId`,
 * `registerNoteId` e `errorPatternId` são slug, porque é assim que a
 * taxonomia é identificada.
 */

// ---------------------------------------------------------------------------
// Spans
// ---------------------------------------------------------------------------

export const SPAN_KINDS = ['CHUNK', 'GRAMMAR', 'REGISTER', 'VOCAB'] as const;
export const spanKindSchema = z.enum(SPAN_KINDS);
export type SpanKind = z.infer<typeof spanKindSchema>;

export const SPAN_KIND_LABELS: Record<SpanKind, string> = {
  CHUNK: 'Expressão pronta',
  GRAMMAR: 'Estrutura gramatical',
  REGISTER: 'Jeito de falar',
  VOCAB: 'Vocabulário',
};

/**
 * Marcação sobre um trecho de texto — é o que permite destacar estruturas
 * na interface. Índices em unidades de código UTF-16, como `String#slice`.
 */
export const spanSchema = z
  .object({
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    kind: spanKindSchema,
    skillId: taxonomySlugSchema.optional(),
    registerNoteId: taxonomySlugSchema.optional(),
  })
  .refine((span) => span.end > span.start, {
    message: 'O fim da marcação precisa vir depois do início.',
    path: ['end'],
  })
  .refine(
    (span) => span.kind !== 'REGISTER' || span.registerNoteId !== undefined,
    {
      message: 'Marcação de registro precisa apontar para uma RegisterNote.',
      path: ['registerNoteId'],
    },
  )
  .refine(
    (span) =>
      span.kind === 'REGISTER' ||
      span.kind === 'VOCAB' ||
      span.skillId !== undefined,
    {
      message: 'Marcação de gramática ou chunk precisa apontar para uma Skill.',
      path: ['skillId'],
    },
  );

export type Span = z.infer<typeof spanSchema>;

const spans = z.array(spanSchema).max(20).default([]);

// ---------------------------------------------------------------------------
// SCENE
// ---------------------------------------------------------------------------

export const sceneLineSchema = z.object({
  characterId: z.uuid(),
  /** Como o personagem fala, do jeito que sai na boca. */
  text: z.string().min(1).max(500),
  /**
   * Forma gramatical completa, só quando difere de `text`.
   * É o que alimenta a alternância "Como se fala / Estrutura gramatical".
   */
  standardText: z.string().min(1).max(500).optional(),
  /** Tradução em pt-BR. */
  translation: z.string().min(1).max(500),
  audioAssetId: z.uuid().optional(),
  spans,
});

export type SceneLine = z.infer<typeof sceneLineSchema>;

export const sceneContentSchema = z.object({
  /** Onde a cena acontece, em pt-BR: "Corredor do prédio, em Austin". */
  location: z.string().min(2).max(200),
  /** Resumo em pt-BR, exibido antes do áudio. */
  summary: z.string().max(500).optional(),
  characterIds: z.array(z.uuid()).min(1).max(8),
  lines: z.array(sceneLineSchema).min(1).max(60),
  /** Áudio da cena inteira. As falas ainda podem ter áudio próprio. */
  audioAssetId: z.uuid().optional(),
});

// ---------------------------------------------------------------------------
// EXPLANATION_CARDS
// ---------------------------------------------------------------------------

export const cardTableSchema = z
  .object({
    headers: z.array(z.string().max(80)).min(1).max(6),
    rows: z
      .array(z.array(z.string().max(160)).min(1).max(6))
      .min(1)
      .max(20),
  })
  .refine(
    (table) => table.rows.every((row) => row.length === table.headers.length),
    {
      message: 'Toda linha da tabela precisa ter o mesmo número de colunas.',
      path: ['rows'],
    },
  );

export const cardExampleSchema = z.object({
  /** Em inglês. */
  text: z.string().min(1).max(300),
  /** Tradução em pt-BR. */
  translation: z.string().max(300).optional(),
  spans,
});

export const explanationCardSchema = z.object({
  title: z.string().min(2).max(160),
  /** Corpo em pt-BR, markdown curto. */
  bodyMd: z.string().min(1).max(4_000),
  table: cardTableSchema.optional(),
  examples: z.array(cardExampleSchema).max(12).default([]),
});

export const explanationCardsContentSchema = z.object({
  cards: z.array(explanationCardSchema).min(1).max(12),
});

// ---------------------------------------------------------------------------
// PRACTICE
// ---------------------------------------------------------------------------

export const practiceContentSchema = z
  .object({
    itemIds: z.array(z.uuid()).min(1).max(30),
    /** Embaralha a ordem dos itens para o aluno. */
    shuffle: z.boolean().default(false),
  })
  .refine(
    (content) => new Set(content.itemIds).size === content.itemIds.length,
    {
      message: 'O mesmo item aparece duas vezes na prática.',
      path: ['itemIds'],
    },
  );

// ---------------------------------------------------------------------------
// FREE_PRODUCTION
// ---------------------------------------------------------------------------

export const rubricCriterionSchema = z.object({
  id: z.string().min(1).max(60),
  /** pt-BR: o que a correção precisa checar. */
  description: z.string().min(4).max(300),
  skillId: taxonomySlugSchema.optional(),
  /** Quando presente, a correção sinaliza este erro se ele aparecer. */
  errorPatternId: taxonomySlugSchema.optional(),
});

export const freeProductionContentSchema = z
  .object({
    /** Enunciado em pt-BR. */
    prompt: z.string().min(4).max(1_000),
    /** Chunks sugeridos, em inglês, para o aluno se apoiar. */
    helpers: z.array(z.string().min(1).max(160)).max(12).default([]),
    rubric: z.array(rubricCriterionSchema).min(1).max(10),
    targetSkillIds: z.array(taxonomySlugSchema).max(10).default([]),
    minWords: z.number().int().positive().max(500).optional(),
  })
  .refine(
    (content) =>
      new Set(content.rubric.map((criterion) => criterion.id)).size ===
      content.rubric.length,
    {
      message: 'Dois critérios da rubrica têm o mesmo id.',
      path: ['rubric'],
    },
  );

// ---------------------------------------------------------------------------
// ROLEPLAY
// ---------------------------------------------------------------------------

export const roleplayGoalSchema = z.object({
  id: z.string().min(1).max(60),
  /** pt-BR: o que o aluno precisa conseguir fazer na conversa. */
  description: z.string().min(4).max(300),
  skillIds: z.array(taxonomySlugSchema).max(5).default([]),
});

export const roleplayContentSchema = z
  .object({
    /** Personagem que a IA interpreta. */
    characterId: z.uuid(),
    /** pt-BR: onde acontece e qual é a situação. */
    scenario: z.string().min(4).max(1_000),
    /** Primeira fala do personagem, em inglês. */
    openingLine: z.string().max(500).optional(),
    goals: z.array(roleplayGoalSchema).min(1).max(6),
    maxTurns: z.number().int().min(2).max(40),
    /** Teto de vocabulário que a IA pode usar na conversa. */
    allowedVocabularyLevel: cefrLevelSchema,
  })
  .refine(
    (content) =>
      new Set(content.goals.map((goal) => goal.id)).size ===
      content.goals.length,
    { message: 'Duas metas do roleplay têm o mesmo id.', path: ['goals'] },
  );

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------

export const summaryContentSchema = z.object({
  /** pt-BR: o que o aluno leva da lição. */
  takeaways: z.array(z.string().min(2).max(300)).min(1).max(10),
  skillIds: z.array(taxonomySlugSchema).max(20).default([]),
  registerNoteIds: z.array(taxonomySlugSchema).max(10).default([]),
});

// ---------------------------------------------------------------------------
// União
// ---------------------------------------------------------------------------

export const LESSON_STEP_TYPES = [
  'SCENE',
  'EXPLANATION_CARDS',
  'PRACTICE',
  'FREE_PRODUCTION',
  'ROLEPLAY',
  'SUMMARY',
] as const;
export const lessonStepTypeSchema = z.enum(LESSON_STEP_TYPES);
export type LessonStepType = z.infer<typeof lessonStepTypeSchema>;

export const LESSON_STEP_TYPE_LABELS: Record<LessonStepType, string> = {
  SCENE: 'Cena',
  EXPLANATION_CARDS: 'Explicação',
  PRACTICE: 'Prática',
  FREE_PRODUCTION: 'Produção livre',
  ROLEPLAY: 'Conversa',
  SUMMARY: 'Resumo',
};

/** Schema do `content` para cada tipo de etapa. */
export const STEP_CONTENT_SCHEMAS = {
  SCENE: sceneContentSchema,
  EXPLANATION_CARDS: explanationCardsContentSchema,
  PRACTICE: practiceContentSchema,
  FREE_PRODUCTION: freeProductionContentSchema,
  ROLEPLAY: roleplayContentSchema,
  SUMMARY: summaryContentSchema,
} as const;

/** Par `{ type, content }` validado junto — é como a etapa chega e sai. */
export const lessonStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SCENE'), content: sceneContentSchema }),
  z.object({
    type: z.literal('EXPLANATION_CARDS'),
    content: explanationCardsContentSchema,
  }),
  z.object({ type: z.literal('PRACTICE'), content: practiceContentSchema }),
  z.object({
    type: z.literal('FREE_PRODUCTION'),
    content: freeProductionContentSchema,
  }),
  z.object({ type: z.literal('ROLEPLAY'), content: roleplayContentSchema }),
  z.object({ type: z.literal('SUMMARY'), content: summaryContentSchema }),
]);

export type LessonStepInput = z.infer<typeof lessonStepSchema>;

export type SceneContent = z.infer<typeof sceneContentSchema>;
export type ExplanationCardsContent = z.infer<
  typeof explanationCardsContentSchema
>;
export type PracticeContent = z.infer<typeof practiceContentSchema>;
export type FreeProductionContent = z.infer<typeof freeProductionContentSchema>;
export type RoleplayContent = z.infer<typeof roleplayContentSchema>;
export type SummaryContent = z.infer<typeof summaryContentSchema>;
