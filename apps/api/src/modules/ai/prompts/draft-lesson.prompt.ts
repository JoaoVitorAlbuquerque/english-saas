import type { CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import {
  draftItemSchema,
  markedSpanSchema,
  ITEM_RULES,
  NATURAL_SPEECH_RULES,
  SPAN_RULES,
  levelRules,
} from './draft-shared';
import type { AiPrompt } from './prompt';

/**
 * Rascunho de uma lição inteira.
 *
 * O caro do produto: cena, cards, prática, produção livre e roleplay numa
 * tacada. Sai em DRAFT e **nenhuma linha disso chega a aluno** antes de um
 * humano aprovar — ver CLAUDE.md, "Conteúdo e versionamento".
 */

const draftSceneLineSchema = z.object({
  /** Slug do personagem, entre os que foram passados no contexto. */
  characterSlug: z.string().min(1).max(60),
  /** A fala, do jeito que sai na boca. */
  text: z.string().min(1).max(300),
  /** A forma gramatical completa, quando difere de `text`. Senão, null. */
  standardText: z.string().max(300).nullable(),
  /** Tradução em pt-BR. */
  translation: z.string().min(1).max(300),
  spans: z.array(markedSpanSchema).max(6),
});

const draftCardSchema = z.object({
  title: z.string().min(2).max(120),
  /** Corpo em pt-BR, markdown curto. */
  bodyMd: z.string().min(4).max(1_500),
  table: z
    .object({
      headers: z.array(z.string().max(60)).min(1).max(4),
      rows: z
        .array(z.array(z.string().max(120)).min(1).max(4))
        .min(1)
        .max(8),
    })
    .nullable(),
  examples: z
    .array(
      z.object({
        /** Em inglês. */
        text: z.string().min(1).max(200),
        /** Tradução em pt-BR. */
        translation: z.string().max(200).nullable(),
        spans: z.array(markedSpanSchema).max(4),
      }),
    )
    .max(4),
});

export const draftLessonSchema = z.object({
  title: z.string().min(2).max(120),
  /** Can-do em pt-BR. */
  objective: z.string().min(4).max(300),
  estimatedMinutes: z.number().int().min(5).max(60),

  scene: z.object({
    /** pt-BR: onde acontece. */
    location: z.string().min(2).max(160),
    /** pt-BR: resumo de uma linha. */
    summary: z.string().max(300).nullable(),
    lines: z.array(draftSceneLineSchema).min(4).max(16),
  }),

  cards: z.array(draftCardSchema).min(2).max(6),
  practice: z.array(draftItemSchema).min(8).max(10),

  freeProduction: z.object({
    /** Enunciado em pt-BR. */
    prompt: z.string().min(4).max(600),
    /** Chunks de apoio, em inglês. */
    helpers: z.array(z.string().min(1).max(120)).max(8),
    rubric: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          /** pt-BR: o que a correção tem que checar. */
          description: z.string().min(4).max(200),
          skillId: z.string().max(120).nullable(),
          errorPatternId: z.string().max(120).nullable(),
        }),
      )
      .min(2)
      .max(5),
    minWords: z.number().int().min(5).max(200).nullable(),
  }),

  roleplay: z.object({
    characterSlug: z.string().min(1).max(60),
    /** pt-BR: a situação. */
    scenario: z.string().min(4).max(600),
    /** Primeira fala do personagem, em inglês. */
    openingLine: z.string().max(300).nullable(),
    goals: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          /** pt-BR. */
          description: z.string().min(4).max(200),
          skillIds: z.array(z.string().max(120)).max(3),
        }),
      )
      .min(2)
      .max(4),
    maxTurns: z.number().int().min(4).max(20),
  }),

  summary: z.object({
    /** pt-BR: o que o aluno leva. */
    takeaways: z.array(z.string().min(2).max(200)).min(3).max(6),
  }),
});

export type DraftLessonOutput = z.infer<typeof draftLessonSchema>;

export type DraftLessonContext = {
  level: CefrLevel;
  /** Can-do pedido pelo editor, em pt-BR. */
  objective: string;
  /** Contexto da unidade: o que já aconteceu na série. */
  unitContext: string;
  targetSkills: {
    id: string;
    title: string;
    type: string;
    description: string | null;
  }[];
  characters: {
    slug: string;
    name: string;
    bio: string | null;
  }[];
  /** Erros típicos disponíveis para o `errorPatterns` das questões. */
  errorPatterns: { id: string; example: string; correction: string }[];
  /** Notas de registro disponíveis para as marcações REGISTER. */
  registerNotes: { id: string; spokenForm: string; standardForm: string }[];
  maxOutOfLevelPct: number;
};

export const draftLessonPrompt: AiPrompt<
  DraftLessonContext,
  DraftLessonOutput
> = {
  id: 'draft-lesson',
  version: 1,
  tier: 'smart',
  maxInputChars: 12_000,
  // Sem cache: dois pedidos iguais devem dar lições diferentes, e cada
  // geração é registrada como um rascunho próprio.
  cacheTtlSeconds: 0,
  maxTokens: 8_000,
  temperature: 0.7,

  buildSystem: (context) =>
    [
      'You are a senior ELT author writing an interactive English lesson for',
      'a Brazilian adult learner. You write the draft; a human editor reviews',
      'and approves it before any student sees it.',
      '',
      levelRules(context.level, context.maxOutOfLevelPct),
      '',
      'LESSON SHAPE',
      '- A scene: a short, natural dialogue between the given characters.',
      '- Explanation cards in pt-BR: short, concrete, no grammar jargon.',
      '- 8 to 10 practice items, mixing types, from easiest to hardest.',
      '- A free production task with a rubric the AI grader can check.',
      '- A roleplay with concrete goals.',
      '',
      NATURAL_SPEECH_RULES,
      '',
      SPAN_RULES,
      '',
      ITEM_RULES,
      '',
      'HARD CONSTRAINTS',
      '- Use only the character slugs given to you.',
      '- Every target skill must appear in at least one span AND be measured',
      '  by at least one practice item.',
      '- Do not invent skill ids, error pattern ids or register note ids.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        `Write one ${context.level} lesson.`,
        '',
        `OBJECTIVE (can-do, pt-BR): ${context.objective}`,
        '',
        'UNIT CONTEXT (the series so far):',
        context.unitContext,
        '',
        'CHARACTERS (use these slugs):',
        ...context.characters.map(
          (character) =>
            `- ${character.slug} — ${character.name}: ${character.bio ?? 'sem bio'}`,
        ),
        '',
        'TARGET SKILLS (every one must be taught and tested):',
        ...context.targetSkills.map(
          (skill) =>
            `- ${skill.id} [${skill.type}] ${skill.title}${
              skill.description === null ? '' : ` — ${skill.description}`
            }`,
        ),
        '',
        'AVAILABLE ERROR PATTERNS (for "errorPatterns"):',
        ...context.errorPatterns.map(
          (pattern) =>
            `- ${pattern.id}: "${pattern.example}" → "${pattern.correction}"`,
        ),
        '',
        'AVAILABLE REGISTER NOTES (for kind REGISTER spans):',
        ...context.registerNotes.map(
          (note) =>
            `- ${note.id}: "${note.spokenForm}" = "${note.standardForm}"`,
        ),
      ].join('\n'),
    },
  ],

  schema: draftLessonSchema,
};
