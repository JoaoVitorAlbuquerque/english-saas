import type { CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import type { AiPrompt } from './prompt';

export const generatorRewriteSentencesSchema = z.object({
  rewrites: z
    .array(
      z.object({
        index: z.number().int().min(0),
        /** Nula = não dá para sustentar com a fonte; a frase sai do texto. */
        sentence: z.string().min(1).max(600).nullable(),
        sourceQuote: z.string().min(1).max(600).nullable(),
      }),
    )
    .max(30),
});

export type GeneratorRewriteSentencesOutput = z.infer<
  typeof generatorRewriteSentencesSchema
>;

export type GeneratorRewriteSentencesContext = {
  level: CefrLevel;
  sentences: { index: number; sentence: string }[];
  /** NÃO confiável. */
  source: string;
};

/**
 * Generator (13): uma chance de consertar a frase que a checagem reprovou.
 * Ou reescreve dizendo só o que a fonte diz, com a citação, ou devolve
 * `null` e a frase sai do texto.
 */
export const generatorRewriteSentencesPrompt: AiPrompt<
  GeneratorRewriteSentencesContext,
  GeneratorRewriteSentencesOutput
> = {
  id: 'generator-rewrite-sentences',
  version: 1,
  tier: 'fast',
  maxInputChars: 48_000,
  cacheTtlSeconds: 0,
  maxTokens: 1_500,
  temperature: 0.2,

  buildSystem: (context) =>
    [
      'Some sentences of a study text are not supported by the source.',
      'For each one, either rewrite it so it states ONLY what the source says,',
      `keeping it simple (CEFR ${context.level}), and give the supporting quote`,
      'copied character for character from the source; or, if the source does',
      'not support the idea at all, return null for both fields.',
      'Never add facts. Keep the same index.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'CONTEXT_JSON',
        JSON.stringify({ sentences: context.sentences }),
        '',
        'SOURCE:',
        wrapUntrusted('source', context.source),
      ].join('\n'),
    },
  ],

  schema: generatorRewriteSentencesSchema,
};
