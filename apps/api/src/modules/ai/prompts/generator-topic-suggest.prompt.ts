import type { CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import type { AiPrompt } from './prompt';

export const GENERATOR_CATEGORIES = [
  'HISTORY',
  'SCIENCE',
  'SPORTS',
  'MUSIC',
  'ARTS',
  'GEOGRAPHY',
  'TECHNOLOGY',
  'OTHER',
] as const;

export const generatorTopicSuggestSchema = z.object({
  safety: z.enum(['OK', 'INAPPROPRIATE']),
  /** Temas que o aluno citou, em pt-BR, curtos ("história", "navegações"). */
  themes: z.array(z.string().min(1).max(60)).max(5),
  suggestions: z
    .array(
      z.object({
        /** Assunto concreto, em inglês, como o título de um artigo. */
        title: z.string().min(2).max(160),
        /** pt-BR, uma ou duas frases. */
        whyInteresting: z.string().min(2).max(400),
        /** Busca na Wikipedia em inglês. */
        wikipediaSearchQuery: z.string().min(2).max(160),
        category: z.enum(GENERATOR_CATEGORIES),
      }),
    )
    .max(3),
});

export type GeneratorTopicSuggestOutput = z.infer<
  typeof generatorTopicSuggestSchema
>;

export type GeneratorTopicSuggestContext = {
  /** O que o aluno escreveu. NÃO confiável. Nulo no "surpreenda-me". */
  interestText: string | null;
  level: CefrLevel;
  /** Interesses do modelo do aluno, mais fortes primeiro. */
  interests: string[];
  /** Assuntos que ele viu há pouco: não repetir. */
  avoidTopics: string[];
};

/**
 * Generator (13), etapa 1: do "gosto de história, principalmente guerras e
 * navegações" para três assuntos concretos, reais e bem documentados.
 * Tier fast: é uma lista curta, e o aluno escolhe.
 */
export const generatorTopicSuggestPrompt: AiPrompt<
  GeneratorTopicSuggestContext,
  GeneratorTopicSuggestOutput
> = {
  id: 'generator-topic-suggest',
  version: 1,
  tier: 'fast',
  maxInputChars: 4_000,
  // Os tópicos a evitar mudam a cada material: cache quase nunca acertaria.
  cacheTtlSeconds: 0,
  maxTokens: 900,
  temperature: 0.7,

  buildSystem: () =>
    [
      'You suggest reading topics for a Brazilian adult learning English.',
      '',
      'TASK',
      '- Understand what the student likes and propose exactly 3 concrete',
      '  subjects: a specific real event, person, place or discovery — not a',
      '  broad area. "The first voyage of Columbus (1492)", not "History".',
      '- Every subject must be real, well documented and covered by a solid',
      '  article on English Wikipedia. No fiction, rumours or recent news.',
      '- Prefer subjects that can be told simply at the student level.',
      '- Do not propose anything listed in avoidTopics.',
      '- Avoid graphic violence, sexual content and divisive current politics.',
      '- wikipediaSearchQuery: the English search that finds that article.',
      '- whyInteresting: one or two short sentences in Brazilian Portuguese.',
      '- themes: the student interests you understood, in pt-BR, 1-3 words each.',
      '- category: the closest one from the allowed list.',
      '- With no interest text, pick from the learner interests list.',
      '- safety: INAPPROPRIATE if the request is offensive, sexual, hateful or',
      '  asks for violence. Then return empty suggestions.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'CONTEXT_JSON',
        JSON.stringify({
          level: context.level,
          interests: context.interests,
          avoidTopics: context.avoidTopics,
        }),
        '',
        'What the student said they like:',
        wrapUntrusted('interest_text', context.interestText ?? ''),
      ].join('\n'),
    },
  ],

  schema: generatorTopicSuggestSchema,
};
