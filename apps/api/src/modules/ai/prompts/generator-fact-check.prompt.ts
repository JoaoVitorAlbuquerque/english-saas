import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import type { AiPrompt } from './prompt';

export const generatorFactCheckSchema = z.object({
  verdicts: z
    .array(
      z.object({
        index: z.number().int().min(0),
        supported: z.boolean(),
        /** pt-BR, curto. Só para log e para a reescrita. */
        reason: z.string().max(300),
      }),
    )
    .max(60),
});

export type GeneratorFactCheckOutput = z.infer<typeof generatorFactCheckSchema>;

export type GeneratorFactCheckContext = {
  /** A citação veio da fonte (não confiável); a frase, do nosso texto. */
  claims: { index: number; sentence: string; sourceQuote: string }[];
};

/**
 * Generator (13): a citação sustenta a frase? A existência literal da
 * citação na fonte já foi conferida sem IA; aqui é o julgamento de sentido
 * (a frase não diz mais do que a citação). Tier fast, temperatura zero.
 */
export const generatorFactCheckPrompt: AiPrompt<
  GeneratorFactCheckContext,
  GeneratorFactCheckOutput
> = {
  id: 'generator-fact-check',
  version: 1,
  tier: 'fast',
  maxInputChars: 20_000,
  // Mesmo par frase+citação, mesmo veredito: o cache vale.
  cacheTtlSeconds: 7 * 24 * 60 * 60,
  maxTokens: 2_000,
  temperature: 0,

  buildSystem: () =>
    [
      'You are a strict fact checker.',
      'For each claim, decide whether the sentence is fully supported by the',
      'quote. "supported" is true only when everything the sentence states —',
      'numbers, dates, names, places, who did what — is in the quote.',
      'Simplified wording is fine. Extra details not in the quote are not.',
      'Return one verdict per claim, using its index. "reason" in pt-BR.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'Claims to check (JSON):',
        wrapUntrusted('claims', JSON.stringify(context.claims)),
      ].join('\n'),
    },
  ],

  schema: generatorFactCheckSchema,
};
