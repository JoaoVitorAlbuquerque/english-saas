import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import type { AiPrompt } from './prompt';

export const generatorIngestAnalysisSchema = z.object({
  safety: z.enum(['OK', 'INAPPROPRIATE']),
  /** ISO 639-1 ("en", "pt"). */
  language: z.string().min(2).max(8),
  genre: z.enum(['NEWS', 'LYRICS', 'OTHER']),
  /** Assunto em pt-BR, 1–3 palavras: vira interesse no modelo do aluno. */
  topic: z.string().min(1).max(60),
  /** Título curto em inglês para o material. */
  title: z.string().min(1).max(160),
});

export type GeneratorIngestAnalysisOutput = z.infer<
  typeof generatorIngestAnalysisSchema
>;

export type GeneratorIngestAnalysisContext = {
  /** O conteúdo do aluno. NÃO confiável. */
  text: string;
};

/**
 * Generator (13), conteúdo do aluno: que língua, que tipo de texto, sobre o
 * quê, e se dá para trabalhar com ele. O nível sai sem IA (`estimateLevel`).
 */
export const generatorIngestAnalysisPrompt: AiPrompt<
  GeneratorIngestAnalysisContext,
  GeneratorIngestAnalysisOutput
> = {
  id: 'generator-ingest-analysis',
  version: 1,
  tier: 'fast',
  maxInputChars: 48_000,
  cacheTtlSeconds: 0,
  maxTokens: 300,
  temperature: 0,

  buildSystem: () =>
    [
      'You classify a text a student wants to study.',
      '- language: ISO 639-1 code of the main language of the text.',
      '- genre: LYRICS for songs and poems, NEWS for news and articles,',
      '  OTHER for anything else.',
      '- topic: what it is about, in Brazilian Portuguese, 1-3 words.',
      '- title: a short English title for a study sheet about it.',
      '- safety: INAPPROPRIATE if it is sexual, hateful or glorifies violence.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'Classify the text below.',
        wrapUntrusted('student_content', context.text),
      ].join('\n'),
    },
  ],

  schema: generatorIngestAnalysisSchema,
};
