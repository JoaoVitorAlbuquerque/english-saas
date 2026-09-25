import { cefrLevelSchema, type CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import type { AiPrompt } from './prompt';

const id = z.string().min(1).max(80);

export const tutorCorrectionSchema = z.object({
  /** INAPPROPRIATE = conteúdo impróprio; o resto da saída é ignorado. */
  safety: z.enum(['OK', 'INAPPROPRIATE']),
  corrected: z.string().max(4_000),
  fixes: z
    .array(
      z.object({
        original: z.string().min(1).max(300),
        suggestion: z.string().min(1).max(300),
        explanationPtBr: z.string().min(1).max(600),
        errorPatternId: id.nullable(),
        skillId: id.nullable(),
        severity: z.enum(['MINOR', 'MAJOR']),
      }),
    )
    .max(20),
  rubric: z
    .array(
      z.object({
        goalId: id,
        met: z.boolean(),
        comment: z.string().max(400),
      }),
    )
    .max(10),
  registerTips: z
    .array(
      z.object({
        yourForm: z.string().min(1).max(300),
        naturalSpokenForm: z.string().min(1).max(300),
        standardForm: z.string().min(1).max(300),
        note: z.string().max(400),
      }),
    )
    .max(5),
  encouragement: z.string().max(400),
  estimatedLevel: cefrLevelSchema,
});

export type TutorCorrectionOutput = z.infer<typeof tutorCorrectionSchema>;

export type TutorCorrectionContext = {
  /** Texto do aluno. Conteúdo NÃO confiável. */
  text: string;
  /** Enunciado da etapa (nosso), quando a correção vem de uma lição. */
  task: string | null;
  rubric: {
    id: string;
    description: string;
    skillId: string | null;
    errorPatternId: string | null;
  }[];
  targetSkills: { id: string; title: string }[];
  learner: {
    level: CefrLevel;
    weakSkills: string[];
    knownErrors: { id: string; description: string }[];
    /** Frases reais do aluno em erros anteriores. NÃO confiável. */
    pastExamples: string[];
  };
  errorCatalog: { id: string; description: string }[];
};

/**
 * Correção de produção livre (módulo 12). Tier smart: é o feedback que o
 * aluno lê com calma, e errar a explicação ensina errado.
 *
 * O contexto nosso (rubrica, catálogo, nível) vai como JSON; o texto do
 * aluno e as frases antigas dele vão embrulhados como conteúdo não
 * confiável, em blocos separados.
 */
export const tutorCorrectionPrompt: AiPrompt<
  TutorCorrectionContext,
  TutorCorrectionOutput
> = {
  id: 'tutor-correction',
  version: 1,
  tier: 'smart',
  maxInputChars: 12_000,
  // Cada correção é única e alimenta o modelo do aluno: nada de cache.
  cacheTtlSeconds: 0,
  maxTokens: 2_500,
  temperature: 0.2,

  buildSystem: () =>
    [
      'You are a friendly English tutor for Brazilian learners.',
      'You correct a short text the student wrote.',
      '',
      'LANGUAGE',
      '- Every explanation, comment, note and encouragement is in Brazilian',
      '  Portuguese (pt-BR): simple, direct, at the student level. No jargon',
      '  the student would not know.',
      '',
      'RULES',
      '- Correct only what is necessary. Do NOT rewrite the whole text; keep',
      '  the student voice. "corrected" is the text with only the needed fixes.',
      '- Never invent errors. If a sentence is fine, leave it alone.',
      '- One fix per real problem. "original" is the exact excerpt the student',
      '  wrote; "suggestion" is the corrected excerpt.',
      '- errorPatternId: ONLY an id from errorCatalog, when the mistake is',
      '  exactly that pattern; otherwise null. Never make up ids.',
      '- skillId: ONLY an id from targetSkills or from the rubric; otherwise null.',
      '- severity MAJOR blocks understanding or is a typical L1 error;',
      '  MINOR is capitalization, punctuation or style.',
      '- rubric: one entry per rubric item, using its id as goalId.',
      '- registerTips: when there is a difference between the standard form',
      '  and how a native speaker would actually say it, show both.',
      '  Example: standardForm "I am going to travel.", naturalSpokenForm',
      '  "I\'m gonna travel.". Only when it really applies.',
      '- estimatedLevel: CEFR level this text shows.',
      '- safety: INAPPROPRIATE if the text is offensive, sexual, hateful or',
      '  violent. Then return empty fixes, rubric and tips.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'CONTEXT_JSON',
        JSON.stringify({
          task: context.task,
          rubric: context.rubric,
          targetSkills: context.targetSkills,
          learner: {
            level: context.learner.level,
            weakSkills: context.learner.weakSkills,
            knownErrors: context.learner.knownErrors,
          },
          errorCatalog: context.errorCatalog,
        }),
        '',
        'Previous sentences where this student made mistakes (for context only):',
        wrapUntrusted('past_examples', context.learner.pastExamples.join('\n')),
        '',
        'Correct the student text below.',
        wrapUntrusted('student_text', context.text),
      ].join('\n'),
    },
  ],

  schema: tutorCorrectionSchema,
};
