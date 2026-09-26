import { taxonomySlugSchema, type CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import { ITEM_RULES } from './draft-shared';
import type { AiPrompt } from './prompt';

export const generatorExercisesSchema = z.object({
  exercises: z
    .array(
      z.object({
        purpose: z.enum([
          'COMPREHENSION',
          'TARGET_STRUCTURE',
          'REGISTER',
          'VOCABULARY',
        ]),
        type: z.enum([
          'MULTIPLE_CHOICE',
          'FILL_BLANK',
          'ORDER_WORDS',
          'TYPE_ANSWER',
          'REGISTER_SWAP',
        ]),
        /** Enunciado em pt-BR. */
        prompt: z.string().min(2).max(500),
        options: z
          .array(
            z.object({
              id: z.string().min(1).max(40),
              text: z.string().min(1).max(200),
            }),
          )
          .nullable(),
        correctOptionIds: z.array(z.string().min(1).max(40)).nullable(),
        sentence: z.string().max(300).nullable(),
        hint: z.string().max(160).nullable(),
        tokens: z.array(z.string().min(1).max(40)).nullable(),
        sourceText: z.string().max(300).nullable(),
        registerNoteId: taxonomySlugSchema.nullable(),
        direction: z
          .enum(['SPOKEN_TO_STANDARD', 'STANDARD_TO_SPOKEN'])
          .nullable(),
        acceptedAnswers: z.array(z.string().min(1).max(300)),
        explanation: z.string().min(4).max(1_000),
        errorPatterns: z.array(
          z.object({
            wrongAnswer: z.string().min(1).max(300),
            errorPatternId: taxonomySlugSchema,
          }),
        ),
        skillIds: z.array(taxonomySlugSchema).min(1).max(3),
      }),
    )
    .min(1)
    .max(12),
});

export type GeneratorExercisesOutput = z.infer<typeof generatorExercisesSchema>;

export type GeneratorExercisesContext = {
  level: CefrLevel;
  /** O texto do material (gerado sobre fonte não confiável). */
  text: string;
  targetSkills: { id: string; title: string }[];
  /** Skill de leitura para as questões de compreensão. */
  comprehensionSkillId: string | null;
  registerNotes: { id: string; spokenForm: string; standardForm: string }[];
  vocabulary: { term: string; meaningPtBr: string }[];
  /** Erros típicos: os do aluno primeiro. */
  errorPatterns: { id: string; description: string }[];
  /** Os que o aluno comete — os distratores devem mirar neles. */
  learnerErrorIds: string[];
  count: { min: number; max: number };
  revisionNotes: string | null;
};

/**
 * Generator (13): os exercícios de **um aluno** sobre um texto. É a parte
 * personalizada — o texto base pode ser de outro aluno, os exercícios
 * miram nas fraquezas deste.
 */
export const generatorExercisesPrompt: AiPrompt<
  GeneratorExercisesContext,
  GeneratorExercisesOutput
> = {
  id: 'generator-exercises',
  version: 1,
  tier: 'fast',
  maxInputChars: 16_000,
  cacheTtlSeconds: 0,
  maxTokens: 5_000,
  temperature: 0.5,

  buildSystem: (context) =>
    [
      'You write practice items about a short English text for a Brazilian',
      `adult learner at CEFR ${context.level}.`,
      '',
      'MIX',
      `- ${String(context.count.min)}-${String(context.count.max)} items, varied types.`,
      '- At least 2 COMPREHENSION items (answerable only by reading the text;',
      '  use the comprehension skill id).',
      '- At least 2 TARGET_STRUCTURE items per target skill, using sentences',
      '  from the text (FILL_BLANK and ORDER_WORDS work well).',
      '- 1 REGISTER_SWAP per given register note, when one is given.',
      '- VOCABULARY items may use the vocabulary list.',
      '- Distractors and "errorPatterns" should target the mistakes this',
      '  learner actually makes (learnerErrorIds) when they fit.',
      '',
      ITEM_RULES,
      '',
      'HARD CONSTRAINTS',
      '- Only facts from the text. Only skill ids, error pattern ids and',
      '  register note ids that were given to you.',
      '- Prompts and explanations in Brazilian Portuguese.',
      '- Never quote more than one short sentence of the text in an item.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'CONTEXT_JSON',
        JSON.stringify({
          level: context.level,
          targetSkills: context.targetSkills,
          comprehensionSkillId: context.comprehensionSkillId,
          registerNotes: context.registerNotes,
          vocabulary: context.vocabulary,
          errorPatterns: context.errorPatterns,
          learnerErrorIds: context.learnerErrorIds,
          count: context.count,
        }),
        '',
        ...(context.revisionNotes === null
          ? []
          : [
              'Your previous items were rejected. Fix this:',
              context.revisionNotes,
              '',
            ]),
        'TEXT:',
        wrapUntrusted('material_text', context.text),
      ].join('\n'),
    },
  ],

  schema: generatorExercisesSchema,
};
