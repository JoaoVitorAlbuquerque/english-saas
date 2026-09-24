import type { Span, SpanKind } from '@english-saas/shared';

import { warn, type QaWarning } from './qa-report';

/**
 * Converte a saída da IA no formato que o módulo 4 grava.
 *
 * O ponto delicado é a marcação. **A IA não devolve índice** — devolve o
 * trecho ("Are you new here?") e qual ocorrência dele. Pedir `start` e `end`
 * para um LLM é pedir número errado: ele não conta caracteres, conta
 * aproximadamente. Aqui a gente acha o trecho no texto e calcula os índices.
 *
 * Quando o trecho não é achado, o resultado é um **aviso de QA**, não uma
 * exceção: uma marcação perdida não pode jogar fora uma lição inteira que o
 * editor ainda vai revisar.
 */

/** Marcação como a IA manda: por trecho, não por índice. */
export type MarkedSpan = {
  text: string;
  /** 1-based, dentro do texto inteiro. Ausente = a primeira. */
  occurrence?: number | null;
  kind: SpanKind;
  skillId?: string | null;
  registerNoteId?: string | null;
};

export type ResolveSpansResult = {
  spans: Span[];
  warnings: QaWarning[];
};

/** Todas as posições em que `needle` aparece, ignorando caixa. */
export function findOccurrences(haystack: string, needle: string): number[] {
  if (needle.length === 0) {
    return [];
  }

  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const positions: number[] = [];
  let from = 0;

  for (;;) {
    const index = lowerHaystack.indexOf(lowerNeedle, from);

    if (index === -1) {
      return positions;
    }

    positions.push(index);
    from = index + 1;
  }
}

/**
 * Transforma marcações por trecho em marcações por índice.
 *
 * Regra de desempate, nessa ordem:
 *
 * 1. a ocorrência pedida pela IA (`occurrence`, 1-based);
 * 2. se ela cair antes do fim da marcação anterior — o que produziria
 *    sobreposição, que o módulo 4 recusa — usa a primeira ocorrência a
 *    partir dali;
 * 3. não achou nenhuma: aviso `SPAN_TEXT_NOT_FOUND` e segue sem a marcação.
 */
export function resolveSpans(
  text: string,
  marked: readonly MarkedSpan[],
  path = '',
): ResolveSpansResult {
  const spans: Span[] = [];
  const warnings: QaWarning[] = [];
  let cursor = 0;

  for (const [index, mark] of marked.entries()) {
    const markPath =
      path === '' ? `spans.${String(index)}` : `${path}.spans.${String(index)}`;
    const positions = findOccurrences(text, mark.text);

    if (positions.length === 0) {
      warnings.push(
        warn(
          'SPAN_TEXT_NOT_FOUND',
          `O trecho "${mark.text}" não aparece em "${text}" — a marcação foi descartada.`,
          markPath,
        ),
      );
      continue;
    }

    const requested = mark.occurrence == null ? 1 : mark.occurrence;
    const preferred = positions[requested - 1];
    const start =
      preferred !== undefined && preferred >= cursor
        ? preferred
        : positions.find((position) => position >= cursor);

    if (start === undefined) {
      warnings.push(
        warn(
          'SPAN_TEXT_NOT_FOUND',
          `O trecho "${mark.text}" só aparece antes de uma marcação anterior — a marcação foi descartada.`,
          markPath,
        ),
      );
      continue;
    }

    const end = start + mark.text.length;

    spans.push({
      start,
      end,
      kind: mark.kind,
      ...(mark.skillId == null ? {} : { skillId: mark.skillId }),
      ...(mark.registerNoteId == null
        ? {}
        : { registerNoteId: mark.registerNoteId }),
    });

    cursor = end;
  }

  return { spans, warnings };
}

// ---------------------------------------------------------------------------
// Item: forma plana da IA → `content` do módulo 4
// ---------------------------------------------------------------------------

/**
 * Como a IA descreve uma questão.
 *
 * É plano de propósito: união discriminada com objeto aninhado é onde o
 * modo estruturado da OpenAI mais escorrega. Cada tipo usa um punhado
 * destes campos e a montagem do `content` de verdade acontece aqui.
 */
export type DraftItem = {
  type: string;
  prompt: string;
  options?: { id: string; text: string }[] | null;
  correctOptionIds?: string[] | null;
  sentence?: string | null;
  hint?: string | null;
  tokens?: string[] | null;
  sourceText?: string | null;
  audioText?: string | null;
  registerNoteId?: string | null;
  direction?: string | null;
  acceptedAnswers?: string[] | null;
  explanation: string;
  errorPatterns?: { wrongAnswer: string; errorPatternId: string }[] | null;
  skillIds: string[];
};

export type MappedItem = {
  type: string;
  prompt: string;
  content: Record<string, unknown>;
  acceptedAnswers: string[];
  explanation: string;
  errorPatternMap: Record<string, string>;
  skillIds: string[];
};

export function mapDraftItem(item: DraftItem): MappedItem {
  const errorPatternMap = Object.fromEntries(
    (item.errorPatterns ?? []).map((entry) => [
      entry.wrongAnswer,
      entry.errorPatternId,
    ]),
  );

  return {
    type: item.type,
    prompt: item.prompt,
    content: buildItemContent(item),
    // Nos tipos de escolha o gabarito mora no conteúdo, e o módulo 4
    // recusa `acceptedAnswers` preenchido.
    acceptedAnswers: hasChoiceAnswer(item.type)
      ? []
      : (item.acceptedAnswers ?? []),
    explanation: item.explanation,
    errorPatternMap,
    skillIds: item.skillIds,
  };
}

function hasChoiceAnswer(type: string): boolean {
  return (
    type === 'MULTIPLE_CHOICE' ||
    type === 'LISTEN_CHOOSE' ||
    type === 'READING_COMPREHENSION'
  );
}

function buildItemContent(item: DraftItem): Record<string, unknown> {
  switch (item.type) {
    case 'MULTIPLE_CHOICE':
      return {
        options: item.options ?? [],
        correctOptionIds: item.correctOptionIds ?? [],
        shuffle: true,
      };

    case 'LISTEN_CHOOSE':
      return {
        // O áudio ainda não existe: a síntese roda na aprovação.
        audioText: item.audioText ?? '',
        audioAssetId: null,
        options: item.options ?? [],
        correctOptionIds: item.correctOptionIds ?? [],
        shuffle: true,
      };

    case 'ORDER_WORDS':
      return { tokens: item.tokens ?? [] };

    case 'FILL_BLANK':
      return {
        sentence: item.sentence ?? '',
        ...(item.hint == null ? {} : { hint: item.hint }),
      };

    case 'TYPE_ANSWER':
      return {
        ...(item.sourceText == null ? {} : { sourceText: item.sourceText }),
        ...(item.hint == null ? {} : { hint: item.hint }),
      };

    case 'DICTATION':
      return {
        audioText: item.audioText ?? '',
        audioAssetId: null,
        maxPlays: 3,
      };

    case 'REGISTER_SWAP':
      return {
        source: item.sourceText ?? '',
        direction: item.direction ?? 'SPOKEN_TO_STANDARD',
        registerNoteId: item.registerNoteId ?? '',
      };

    default:
      return {};
  }
}
