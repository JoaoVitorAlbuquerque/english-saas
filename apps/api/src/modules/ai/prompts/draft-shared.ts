import {
  DRAFTABLE_ITEM_TYPES,
  cefrLevelSchema,
  spanKindSchema,
  taxonomySlugSchema,
  type CefrLevel,
} from '@english-saas/shared';
import { z } from 'zod';

/**
 * Peças compartilhadas pelos prompts de autoria.
 *
 * Duas decisões de forma valem explicação, porque as duas são por causa do
 * modo estruturado da OpenAI e não por gosto:
 *
 * 1. **`nullable`, nunca `optional`.** No `json_schema` estrito toda
 *    propriedade é obrigatória; ausência se expressa com `null`.
 * 2. **Objetos planos.** União discriminada aninhada é onde o modo estrito
 *    mais escorrega. A questão vem plana e quem monta o `content` de
 *    verdade é o `draft-mapping` do módulo 5.
 */

/** Marcação por trecho, não por índice — LLM não conta caractere. */
export const markedSpanSchema = z.object({
  /** O trecho exato, copiado do texto. */
  text: z.string().min(1).max(200),
  /** 1 = a primeira vez que o trecho aparece no texto. */
  occurrence: z.number().int().min(1).nullable(),
  kind: spanKindSchema,
  skillId: taxonomySlugSchema.nullable(),
  registerNoteId: taxonomySlugSchema.nullable(),
});

/** A lista mora no `packages/shared`, porque o formulário do admin usa a mesma. */
export { DRAFTABLE_ITEM_TYPES };

export const draftItemSchema = z.object({
  type: z.enum(DRAFTABLE_ITEM_TYPES),
  /** Enunciado em pt-BR. */
  prompt: z.string().min(2).max(500),

  /** MULTIPLE_CHOICE e LISTEN_CHOOSE. */
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        text: z.string().min(1).max(200),
      }),
    )
    .nullable(),
  correctOptionIds: z.array(z.string().min(1).max(40)).nullable(),

  /** FILL_BLANK: a lacuna é `___`. */
  sentence: z.string().max(300).nullable(),
  hint: z.string().max(160).nullable(),

  /** ORDER_WORDS: as peças embaralhadas. */
  tokens: z.array(z.string().min(1).max(40)).nullable(),

  /** TYPE_ANSWER e REGISTER_SWAP: a frase de partida. */
  sourceText: z.string().max(300).nullable(),
  /** LISTEN_CHOOSE e DICTATION: o que o TTS vai falar. */
  audioText: z.string().max(300).nullable(),
  /** REGISTER_SWAP. */
  registerNoteId: taxonomySlugSchema.nullable(),
  direction: z.enum(['SPOKEN_TO_STANDARD', 'STANDARD_TO_SPOKEN']).nullable(),

  /** Vazio nos tipos de escolha: lá o gabarito está nas alternativas. */
  acceptedAnswers: z.array(z.string().min(1).max(300)),
  /** pt-BR, curta e direta. Precisa citar a resposta certa. */
  explanation: z.string().min(4).max(1_000),
  errorPatterns: z.array(
    z.object({
      wrongAnswer: z.string().min(1).max(300),
      errorPatternId: taxonomySlugSchema,
    }),
  ),
  skillIds: z.array(taxonomySlugSchema).min(1).max(5),
});

export type DraftItemOutput = z.infer<typeof draftItemSchema>;

export const draftRegisterNoteSchema = z.object({
  id: taxonomySlugSchema,
  spokenForm: z.string().min(1).max(200),
  standardForm: z.string().min(1).max(200),
  register: z.enum(['INFORMAL_SPOKEN', 'NEUTRAL', 'FORMAL']),
  /** pt-BR: o que muda e quando usar. */
  explanation: z.string().min(4).max(1_000),
  /** pt-BR: onde não cabe. */
  whenToAvoid: z.string().max(300).nullable(),
  cefrLevel: cefrLevelSchema,
});

// ---------------------------------------------------------------------------
// Blocos de instrução reaproveitados
// ---------------------------------------------------------------------------

/** Regra de nível, com o teto de palavras difíceis. */
export function levelRules(level: CefrLevel, maxOutOfLevelPct = 5): string {
  return [
    `LEVEL: ${level} (CEFR). The learner is a Brazilian adult.`,
    `- Keep vocabulary and grammar inside ${level}.`,
    `- At most ~${String(maxOutOfLevelPct)}% of running words may be above ${level},`,
    '  and only when the context makes them obvious.',
    '- Prefer short, high-frequency words over precise rare ones.',
    '- Never explain English grammar in English: every explanation, card body,',
    '  translation and rubric line is in Brazilian Portuguese (pt-BR).',
  ].join('\n');
}

/** Regra de fala natural e de registro — o diferencial do produto. */
export const NATURAL_SPEECH_RULES = [
  'NATURAL SPEECH',
  '- Dialogue must sound like people talking, not like a textbook.',
  '- Use the contracted forms people actually say ("I\'m", "he\'s", "it\'s").',
  '- When a line is colloquial and its full grammatical form differs, put the',
  '  full form in "standardText". When they are the same, use null.',
  '- Do not invent slang the learner will never hear.',
].join('\n');

/** Regra de marcação: trecho + ocorrência, nunca índice. */
export const SPAN_RULES = [
  'HIGHLIGHTS ("spans")',
  '- A span marks a stretch of the English line so the interface can show it.',
  '- Give the exact substring in "text", copied character for character from',
  '  the line. Never give character offsets.',
  '- "occurrence" is 1 for the first time that substring appears in the line,',
  '  2 for the second, and so on.',
  '- Spans in one line must not overlap, and must be listed left to right.',
  '- kind GRAMMAR or CHUNK requires "skillId"; kind REGISTER requires',
  '  "registerNoteId"; kind VOCAB may have neither.',
  '- Only use skillId and registerNoteId values that were given to you.',
].join('\n');

/** Regra de questão, por tipo. O que preencher e o que deixar null. */
export const ITEM_RULES = [
  'ITEMS',
  '- MULTIPLE_CHOICE: fill "options" (2-4) and "correctOptionIds".',
  '  Leave "acceptedAnswers" empty.',
  '- LISTEN_CHOOSE: same, plus "audioText" with the sentence to be spoken.',
  '- ORDER_WORDS: "tokens" are the shuffled pieces. They must be exactly the',
  '  words of the accepted answer — same words, same count, nothing else.',
  '- FILL_BLANK: "sentence" marks the gap with three underscores (___).',
  '  One accepted answer per gap.',
  '- TYPE_ANSWER: "sourceText" is the pt-BR sentence to translate.',
  '- DICTATION: "audioText" is what is spoken; the accepted answer is the',
  '  same sentence written out.',
  '- REGISTER_SWAP: "sourceText" is the starting sentence and "direction"',
  '  says which way to rewrite it.',
  '- "explanation" is pt-BR and must mention the correct answer explicitly.',
  '- "errorPatterns" maps a plausible wrong answer to one of the error',
  '  pattern ids you were given. Leave empty if none fits.',
].join('\n');
