import {
  cefrLevelSchema,
  spanKindSchema,
  taxonomySlugSchema,
  type CefrLevel,
} from '@english-saas/shared';
import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import { NATURAL_SPEECH_RULES } from './draft-shared';
import type { AiPrompt } from './prompt';

export const generatorMaterialSchema = z.object({
  /** INAPPROPRIATE = a fonte é imprópria para virar material. */
  safety: z.enum(['OK', 'INAPPROPRIATE']),
  title: z.string().min(1).max(160),
  text: z.string().min(1).max(8_000),
  /** Marcação por trecho — o índice é calculado do nosso lado. */
  spans: z
    .array(
      z.object({
        text: z.string().min(1).max(200),
        occurrence: z.number().int().min(1).nullable(),
        kind: spanKindSchema,
        skillId: taxonomySlugSchema.nullable(),
        registerNoteId: taxonomySlugSchema.nullable(),
        explanationPtBr: z.string().min(1).max(400),
      }),
    )
    .max(30),
  /** Cada fato do texto ligado a um trecho copiado da fonte. */
  claims: z
    .array(
      z.object({
        sentence: z.string().min(1).max(600),
        sourceQuote: z.string().min(1).max(600),
      }),
    )
    .max(60),
  grammarSpotlight: z
    .array(
      z.object({
        skillId: taxonomySlugSchema,
        structure: z.string().min(1).max(160),
        examplesFromText: z.array(z.string().min(1).max(300)).max(5),
        explanationPtBr: z.string().min(1).max(800),
      }),
    )
    .max(5),
  spokenVersion: z.object({
    /** pt-BR: quem conversa e onde. */
    setup: z.string().min(1).max(300),
    lines: z
      .array(
        z.object({
          speaker: z.string().min(1).max(40),
          spoken: z.string().min(1).max(300),
          standard: z.string().min(1).max(300).nullable(),
        }),
      )
      .min(2)
      .max(12),
  }),
  registerNotes: z
    .array(
      z.object({
        registerNoteId: taxonomySlugSchema.nullable(),
        spoken: z.string().min(1).max(200),
        standard: z.string().min(1).max(200),
        notePtBr: z.string().min(1).max(500),
      }),
    )
    .max(5),
  vocabulary: z
    .array(
      z.object({
        term: z.string().min(1).max(80),
        meaningPtBr: z.string().min(1).max(200),
        example: z.string().min(1).max(300),
        cefr: cefrLevelSchema,
      }),
    )
    .max(12),
});

export type GeneratorMaterialOutput = z.infer<typeof generatorMaterialSchema>;

export type GeneratorMaterialContext = {
  mode: 'TOPIC' | 'INGEST';
  level: CefrLevel;
  profile: {
    minWords: number;
    maxWords: number;
    maxSentenceWords: number;
    grammarGuide: string;
  };
  maxOutOfLevelPct: number;
  targetSkills: { id: string; title: string }[];
  registerNotes: { id: string; spokenForm: string; standardForm: string }[];
  /** INGEST: gênero do texto do aluno (LYRICS pede mais registro falado). */
  genre: 'NEWS' | 'LYRICS' | 'OTHER' | null;
  sourceTitle: string;
  /** A fonte: Wikipedia ou o texto do aluno. NÃO confiável. */
  source: string;
  /** Retorno de uma tentativa anterior (palavras acima do nível, tamanho). */
  revisionNotes: string | null;
};

/**
 * Generator (13), o texto do material. Tier smart: é o que o aluno estuda,
 * e a regra de fatos precisa ser seguida com rigor.
 *
 * A fonte vai inteira como conteúdo não confiável — é de lá que saem os
 * fatos, nunca as instruções. Sem cache aqui: o material base validado
 * fica no banco (`MaterialBase`) e é ele que outro aluno reaproveita.
 */
export const generatorMaterialPrompt: AiPrompt<
  GeneratorMaterialContext,
  GeneratorMaterialOutput
> = {
  id: 'generator-material',
  version: 1,
  tier: 'smart',
  maxInputChars: 48_000,
  cacheTtlSeconds: 0,
  maxTokens: 6_000,
  temperature: 0.4,

  buildSystem: (context) =>
    [
      'You write English study material for a Brazilian adult learner.',
      context.mode === 'TOPIC'
        ? 'You retell a real event using ONLY the source article you are given.'
        : 'You turn a text the student sent into study material: an adapted summary of it.',
      '',
      'FACTS — HARD RULES',
      '- Use ONLY facts stated in the source. No date, number, name, place or',
      '  event that is not in the source, even if you know it is true.',
      '- Every sentence with a fact goes in "claims": the sentence exactly as',
      '  it appears in your text, and "sourceQuote" copied character for',
      '  character from the source (a full clause, at least a few words).',
      '- If you cannot quote the source for a fact, leave the fact out.',
      '- Never claim more than the source says. Simplifying is fine;',
      '  exaggerating or guessing is not.',
      '',
      `LEVEL: ${context.level} (CEFR)`,
      `- Length: ${String(context.profile.minWords)}-${String(context.profile.maxWords)} words.`,
      `- Sentences of at most ${String(context.profile.maxSentenceWords)} words.`,
      `- Grammar: ${context.profile.grammarGuide}`,
      `- At most ~${String(context.maxOutOfLevelPct)}% of words above ${context.level},`,
      '  and only when the context makes them clear. Put those in "vocabulary".',
      '',
      'TARGET STRUCTURES',
      '- Use every target structure naturally and several times in the text.',
      '- Add a "grammarSpotlight" entry per target, with examples copied from',
      '  your text and a short explanation in Brazilian Portuguese.',
      '- Highlight target structures in "spans" (kind GRAMMAR with its skillId).',
      '',
      'SPOKEN VERSION',
      '- "spokenVersion": two people chatting about the subject the way people',
      '  really talk (contractions, short answers, fillers kept light).',
      '- When a line is colloquial and the full grammatical form differs, put',
      '  the full form in "standard"; otherwise null.',
      NATURAL_SPEECH_RULES,
      '',
      'REGISTER NOTES',
      '- "registerNotes": contrast spoken and standard forms that appear in the',
      '  spoken version. Use the given register note ids when they apply.',
      ...(context.genre === 'LYRICS'
        ? [
            "- This is a song: explain its colloquial forms (gonna, wanna, ain't,",
            '  dropped letters) against the standard form.',
            '- Do NOT reproduce the lyrics. Quote at most one short line at a time.',
          ]
        : []),
      '',
      'OTHER FIELDS',
      '- "spans": exact substrings of your text, never character offsets;',
      '  kind GRAMMAR/CHUNK need a given skillId, REGISTER a given registerNoteId.',
      '- "vocabulary": up to 10 useful words or chunks from the text, with the',
      '  meaning in pt-BR, an example sentence and the CEFR level.',
      '- All explanations are in Brazilian Portuguese, simple and friendly.',
      '- Only use skill ids and register note ids that were given to you.',
      '- safety: INAPPROPRIATE if the source is sexual, hateful or glorifies',
      '  violence. Then return an empty text.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'CONTEXT_JSON',
        JSON.stringify({
          mode: context.mode,
          level: context.level,
          profile: context.profile,
          targetSkills: context.targetSkills,
          registerNotes: context.registerNotes,
          genre: context.genre,
          sourceTitle: context.sourceTitle,
        }),
        '',
        ...(context.revisionNotes === null
          ? []
          : [
              'Your previous attempt was rejected. Fix this and write it again:',
              context.revisionNotes,
              '',
            ]),
        'SOURCE (the only allowed source of facts):',
        wrapUntrusted('source', context.source),
      ].join('\n'),
    },
  ],

  schema: generatorMaterialSchema,
};
