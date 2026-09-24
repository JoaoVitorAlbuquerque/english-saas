import { z } from 'zod';

import type { AiPrompt } from './prompt';

/**
 * Revisão linguística de um rascunho.
 *
 * Aponta erro de inglês e tradução ruim. **Não corrige nada** — a saída vira
 * uma lista de avisos que o editor lê. Conteúdo alterado por IA sem humano
 * no meio é exatamente o que este módulo existe para evitar.
 *
 * Tier `fast`: é leitura de texto curto, roda em todo rascunho, e o volume
 * não justifica o modelo caro.
 */

export const reviewLanguageSchema = z.object({
  issues: z
    .array(
      z.object({
        /** Onde: o caminho que veio no pedido ("scene.lines.2"). */
        path: z.string().min(1).max(120),
        kind: z.enum(['ENGLISH', 'TRANSLATION']),
        /** O trecho problemático, copiado. */
        excerpt: z.string().min(1).max(300),
        /** pt-BR: o que está errado. */
        message: z.string().min(4).max(400),
        /** Como ficaria melhor. Em inglês ou pt-BR, conforme o caso. */
        suggestion: z.string().max(300).nullable(),
      }),
    )
    .max(30),
});

export type ReviewLanguageOutput = z.infer<typeof reviewLanguageSchema>;

export type ReviewLanguageSegment = {
  /** Identificação do trecho, devolvida no `path` do problema. */
  path: string;
  /** Texto em inglês. */
  english: string;
  /** Tradução em pt-BR, quando existe. */
  portuguese?: string | undefined;
};

export type ReviewLanguageContext = {
  segments: ReviewLanguageSegment[];
};

export const reviewLanguagePrompt: AiPrompt<
  ReviewLanguageContext,
  ReviewLanguageOutput
> = {
  id: 'review-language',
  version: 1,
  tier: 'fast',
  maxInputChars: 10_000,
  cacheTtlSeconds: 0,
  maxTokens: 3_000,
  temperature: 0,

  buildSystem: () =>
    [
      'You are a bilingual proofreader (English / Brazilian Portuguese) for an',
      'English course. You are reviewing a draft written by another model.',
      '',
      'TASK',
      'Report problems. Do NOT rewrite the content.',
      '',
      'WHAT COUNTS AS A PROBLEM',
      '- ENGLISH: grammar mistakes, unnatural phrasing, wrong collocation, a',
      '  line no native speaker would say.',
      '- TRANSLATION: a pt-BR translation that is wrong, misleading, awkward,',
      '  or a literal rendering that loses the meaning.',
      '',
      'WHAT IS NOT A PROBLEM',
      '- Contractions and everyday spoken forms. This course teaches those on',
      '  purpose; "He\'s so cute" and "You coming?" are correct here.',
      '- Simple vocabulary. The text is deliberately written for beginners.',
      '- Style preferences. Only report what is actually wrong.',
      '',
      'OUTPUT',
      '- "path": copy the path given with the segment.',
      '- "message": pt-BR, one sentence, addressed to the editor.',
      '- Empty list when nothing is wrong. Do not invent problems to look',
      '  useful.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'Review the segments below.',
        '',
        ...context.segments.map((segment) =>
          [
            `[${segment.path}]`,
            `EN: ${segment.english}`,
            segment.portuguese === undefined
              ? null
              : `PT: ${segment.portuguese}`,
          ]
            .filter((line) => line !== null)
            .join('\n'),
        ),
      ].join('\n\n'),
    },
  ],

  schema: reviewLanguageSchema,
};
