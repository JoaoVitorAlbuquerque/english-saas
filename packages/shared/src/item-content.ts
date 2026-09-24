import { z } from 'zod';

import { taxonomySlugSchema } from './curriculum';
import { spanSchema } from './lesson-content';

/**
 * Banco de questões.
 *
 * Um `Item` guarda `type` + `content` (JSON) validado por tipo. Onde mora a
 * resposta certa depende do tipo:
 *
 * - **escolha** (MULTIPLE_CHOICE, LISTEN_CHOOSE, READING_COMPREHENSION) e
 *   MATCH: a resposta está no próprio `content`, e `acceptedAnswers` fica
 *   vazio;
 * - **digitados** (ORDER_WORDS, FILL_BLANK, TYPE_ANSWER, DICTATION,
 *   REGISTER_SWAP): a resposta está em `acceptedAnswers`, comparada depois
 *   de normalizar (ver `domain/answer-normalization.ts` na API).
 */

export const ITEM_TYPES = [
  'MULTIPLE_CHOICE',
  'LISTEN_CHOOSE',
  'ORDER_WORDS',
  'FILL_BLANK',
  'TYPE_ANSWER',
  'MATCH',
  'DICTATION',
  'READING_COMPREHENSION',
  'REGISTER_SWAP',
] as const;
export const itemTypeSchema = z.enum(ITEM_TYPES);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  MULTIPLE_CHOICE: 'Múltipla escolha',
  LISTEN_CHOOSE: 'Ouvir e escolher',
  ORDER_WORDS: 'Ordenar as palavras',
  FILL_BLANK: 'Completar a lacuna',
  TYPE_ANSWER: 'Escrever a resposta',
  MATCH: 'Ligar os pares',
  DICTATION: 'Ditado',
  READING_COMPREHENSION: 'Interpretação de texto',
  REGISTER_SWAP: 'Trocar o registro',
};

/** Tipos cuja resposta certa vive em `acceptedAnswers`. */
export const TYPED_ANSWER_ITEM_TYPES = [
  'ORDER_WORDS',
  'FILL_BLANK',
  'TYPE_ANSWER',
  'DICTATION',
  'REGISTER_SWAP',
] as const satisfies readonly ItemType[];

export function hasTypedAnswer(type: ItemType): boolean {
  return (TYPED_ANSWER_ITEM_TYPES as readonly ItemType[]).includes(type);
}

export const ITEM_SOURCES = ['HUMAN', 'AI_DRAFT_REVIEWED'] as const;
export const itemSourceSchema = z.enum(ITEM_SOURCES);
export type ItemSource = z.infer<typeof itemSourceSchema>;

// ---------------------------------------------------------------------------
// Peças reaproveitadas
// ---------------------------------------------------------------------------

const optionSchema = z.object({
  id: z.string().min(1).max(40),
  /** Em inglês, salvo quando o item pede a tradução. */
  text: z.string().min(1).max(300),
  /** Tradução em pt-BR, quando ajuda. */
  translation: z.string().max(300).optional(),
});

const choiceFields = {
  options: z.array(optionSchema).min(2).max(6),
  correctOptionIds: z.array(z.string().min(1).max(40)).min(1),
  shuffle: z.boolean().default(true),
};

/** Opções com id único e gabarito apontando para opções existentes. */
function checkChoice(
  content: { options: { id: string }[]; correctOptionIds: string[] },
  ctx: z.RefinementCtx,
): void {
  const ids = new Set(content.options.map((option) => option.id));

  if (ids.size !== content.options.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Duas alternativas têm o mesmo id.',
      path: ['options'],
    });
  }

  if (content.correctOptionIds.some((id) => !ids.has(id))) {
    ctx.addIssue({
      code: 'custom',
      message: 'O gabarito aponta para uma alternativa que não existe.',
      path: ['correctOptionIds'],
    });
  }
}

// ---------------------------------------------------------------------------
// Um schema por tipo
// ---------------------------------------------------------------------------

export const multipleChoiceContentSchema = z
  .object({ ...choiceFields })
  .superRefine(checkChoice);

export const listenChooseContentSchema = z
  .object({ audioAssetId: z.uuid(), ...choiceFields })
  .superRefine(checkChoice);

export const orderWordsContentSchema = z.object({
  /** Peças embaralhadas que o aluno arrasta. */
  tokens: z.array(z.string().min(1).max(40)).min(2).max(20),
});

export const fillBlankContentSchema = z
  .object({
    /** A lacuna é `___` (três sublinhados): "Biscuit ___ a dog." */
    sentence: z.string().min(3).max(300),
    /** Dica em pt-BR. */
    hint: z.string().max(160).optional(),
    /** Alternativas prontas, quando não é para digitar livre. */
    choices: z.array(z.string().min(1).max(60)).max(6).optional(),
  })
  .refine((content) => content.sentence.includes('___'), {
    message: 'A frase precisa marcar a lacuna com ___ (três sublinhados).',
    path: ['sentence'],
  });

export const typeAnswerContentSchema = z.object({
  /** O que o aluno tem que verter, quando o enunciado não basta. */
  sourceText: z.string().max(300).optional(),
  hint: z.string().max(160).optional(),
});

export const matchContentSchema = z
  .object({
    pairs: z
      .array(
        z.object({
          left: z.string().min(1).max(160),
          right: z.string().min(1).max(160),
        }),
      )
      .min(2)
      .max(8),
  })
  .refine(
    (content) =>
      new Set(content.pairs.map((pair) => pair.left)).size ===
      content.pairs.length,
    { message: 'O lado esquerdo tem itens repetidos.', path: ['pairs'] },
  );

export const dictationContentSchema = z.object({
  audioAssetId: z.uuid(),
  /** Quantas vezes o aluno pode ouvir. 0 = sem limite. */
  maxPlays: z.number().int().min(0).max(10).default(0),
});

export const readingComprehensionContentSchema = z
  .object({
    passage: z.string().min(20).max(4_000),
    /** Tradução em pt-BR, liberada depois da resposta. */
    passageTranslation: z.string().max(4_000).optional(),
    spans: z.array(spanSchema).max(30).default([]),
    ...choiceFields,
  })
  .superRefine(checkChoice);

export const REGISTER_SWAP_DIRECTIONS = [
  'SPOKEN_TO_STANDARD',
  'STANDARD_TO_SPOKEN',
] as const;
export const registerSwapDirectionSchema = z.enum(REGISTER_SWAP_DIRECTIONS);
export type RegisterSwapDirection = z.infer<typeof registerSwapDirectionSchema>;

export const registerSwapContentSchema = z.object({
  /** A frase de partida, em inglês. */
  source: z.string().min(2).max(300),
  direction: registerSwapDirectionSchema,
  registerNoteId: taxonomySlugSchema,
});

// ---------------------------------------------------------------------------
// União
// ---------------------------------------------------------------------------

export const ITEM_CONTENT_SCHEMAS = {
  MULTIPLE_CHOICE: multipleChoiceContentSchema,
  LISTEN_CHOOSE: listenChooseContentSchema,
  ORDER_WORDS: orderWordsContentSchema,
  FILL_BLANK: fillBlankContentSchema,
  TYPE_ANSWER: typeAnswerContentSchema,
  MATCH: matchContentSchema,
  DICTATION: dictationContentSchema,
  READING_COMPREHENSION: readingComprehensionContentSchema,
  REGISTER_SWAP: registerSwapContentSchema,
} as const;

export const itemContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    content: multipleChoiceContentSchema,
  }),
  z.object({
    type: z.literal('LISTEN_CHOOSE'),
    content: listenChooseContentSchema,
  }),
  z.object({
    type: z.literal('ORDER_WORDS'),
    content: orderWordsContentSchema,
  }),
  z.object({ type: z.literal('FILL_BLANK'), content: fillBlankContentSchema }),
  z.object({
    type: z.literal('TYPE_ANSWER'),
    content: typeAnswerContentSchema,
  }),
  z.object({ type: z.literal('MATCH'), content: matchContentSchema }),
  z.object({ type: z.literal('DICTATION'), content: dictationContentSchema }),
  z.object({
    type: z.literal('READING_COMPREHENSION'),
    content: readingComprehensionContentSchema,
  }),
  z.object({
    type: z.literal('REGISTER_SWAP'),
    content: registerSwapContentSchema,
  }),
]);

/** Resposta errada (já normalizada) → id do ErrorPattern que ela revela. */
export const errorPatternMapSchema = z.record(
  z.string().min(1).max(300),
  taxonomySlugSchema,
);

export type ErrorPatternMap = z.infer<typeof errorPatternMapSchema>;
