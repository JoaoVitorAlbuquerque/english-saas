import { cefrLevelSchema } from '@english-saas/shared';
import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import type { AiPrompt } from './prompt';

export const echoLevelSchema = z.object({
  level: cefrLevelSchema,
  /** Quanto o modelo confia na classificação, de 0 a 1. */
  confidence: z.number().min(0).max(1),
  /** Justificativa curta, em pt-BR — o aluno pode ver isso. */
  reason: z.string().min(1).max(400),
  /** Contraste entre a forma escrita e a falada, quando fizer sentido. */
  registerNote: z
    .object({
      written: z.string().min(1).max(200),
      spoken: z.string().min(1).max(200),
    })
    .nullable(),
});

export type EchoLevelOutput = z.infer<typeof echoLevelSchema>;

export type EchoLevelContext = {
  /** Frase em inglês enviada pelo aluno. Conteúdo NÃO confiável. */
  sentence: string;
};

/**
 * Prompt de exemplo do módulo: classifica uma frase em inglês por nível CEFR.
 *
 * Serve de referência para os prompts de verdade (módulos 5, 12 e 13) e de
 * prova viva de que o caminho completo funciona — validação zod, cache,
 * custo e registro em `ai_usages`.
 */
export const echoLevelPrompt: AiPrompt<EchoLevelContext, EchoLevelOutput> = {
  id: 'echo-level',
  version: 1,
  tier: 'fast',
  maxInputChars: 1_000,
  cacheTtlSeconds: 86_400,
  maxTokens: 400,
  temperature: 0,

  buildSystem: () =>
    [
      'You are a CEFR assessment assistant for Brazilian learners of English.',
      '',
      'TASK',
      'Classify the difficulty of a single English sentence on the CEFR scale',
      '(A1, A2, B1, B2, C1) from the point of view of a Brazilian student.',
      '',
      'HOW TO DECIDE',
      '- Weigh grammar structures, vocabulary frequency and idiomaticity.',
      '- Judge the sentence as written; do not rewrite or improve it.',
      '',
      'OUTPUT',
      '- "reason": one short sentence in Brazilian Portuguese (pt-BR),',
      '  addressed to the student, explaining what makes it that level.',
      '- "registerNote": if the sentence has a everyday spoken form that',
      '  differs from the written one (e.g. "going to" vs "gonna",',
      '  "Are you coming?" vs "You coming?"), fill it in. Otherwise use null.',
      '- "confidence": 0 to 1.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        'Classify the sentence inside the tags below.',
        '',
        wrapUntrusted('student_sentence', context.sentence),
      ].join('\n'),
    },
  ],

  cacheInput: (context) => ({ sentence: context.sentence }),

  schema: echoLevelSchema,
};
