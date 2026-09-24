import type {
  AnswerResponse,
  AnswerVerdict,
  ItemType,
} from '@english-saas/shared';

import {
  answerVariants,
  findErrorPattern,
  matchesAnswer,
} from 'src/modules/curriculum/domain/answer-normalization';

/**
 * Correção de resposta objetiva.
 *
 * Função pura por tipo de item. Quem decide o que é "a mesma resposta" é a
 * normalização do curriculum (`answer-normalization.ts`) — caixa,
 * pontuação, contração. Aqui só se aplica isso a cada formato.
 *
 * Crédito parcial existe em dois tipos, e só neles:
 *
 * - **ORDER_WORDS**: maior subsequência comum entre a frase montada e o
 *   gabarito, dividida pelo tamanho do maior dos dois. "Nice meet to you"
 *   acerta 3 de 4 na ordem certa → 0.75.
 * - **MATCH**: pares certos ÷ total de pares.
 *
 * Nos outros, ou acertou ou não. `isCorrect` só é verdadeiro com score 1.
 */

export type EvaluableItem = {
  type: ItemType;
  content: unknown;
  acceptedAnswers: readonly string[];
  errorPatternMap: Readonly<Record<string, string>>;
};

/** O gabarito, no mesmo formato da resposta. Só sai depois de responder. */
export type CorrectAnswer =
  | { optionIds: string[]; texts: string[] }
  | { text: string }
  | { pairs: { left: string; right: string }[] };

export type Evaluation = {
  isCorrect: boolean;
  /** 0–1, duas casas. */
  score: number;
  verdict: AnswerVerdict;
  /** Frase curta em pt-BR. A explicação do item vem à parte. */
  feedback: string;
  /** Ids de ErrorPattern que a resposta revelou. */
  errorPatterns: string[];
  correctAnswer: CorrectAnswer;
};

type Option = { id: string; text: string };

const CHOICE_TYPES: readonly ItemType[] = [
  'MULTIPLE_CHOICE',
  'LISTEN_CHOOSE',
  'READING_COMPREHENSION',
];

const TEXT_TYPES: readonly ItemType[] = [
  'FILL_BLANK',
  'TYPE_ANSWER',
  'DICTATION',
  'REGISTER_SWAP',
];

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

/**
 * A resposta tem o formato do tipo do item, e aponta para peças que
 * existem? Devolve o motivo em pt-BR, ou `null` quando está tudo certo.
 *
 * Isto é diferente de errar: resposta com formato errado é bug do cliente
 * (ou alguém mexendo na requisição), e vira 422 — não vira resposta errada
 * gravada no histórico do aluno.
 */
export function responseShapeError(
  item: Pick<EvaluableItem, 'type' | 'content'>,
  response: AnswerResponse,
): string | null {
  if (CHOICE_TYPES.includes(item.type)) {
    if (!('optionIds' in response)) {
      return 'Esta questão espera a escolha de uma alternativa.';
    }

    const known = new Set(optionsOf(item.content).map((option) => option.id));
    const unknown = response.optionIds.filter((id) => !known.has(id));

    return unknown.length > 0
      ? 'Uma das alternativas enviadas não existe nesta questão.'
      : null;
  }

  if (TEXT_TYPES.includes(item.type)) {
    return 'text' in response
      ? null
      : 'Esta questão espera uma resposta escrita.';
  }

  if (item.type === 'ORDER_WORDS') {
    if (!('tokens' in response)) {
      return 'Esta questão espera as peças em ordem.';
    }

    return sameMultiset(response.tokens, tokensOf(item.content))
      ? null
      : 'As peças enviadas não são as desta questão.';
  }

  if (item.type === 'MATCH') {
    if (!('pairs' in response)) {
      return 'Esta questão espera os pares ligados.';
    }

    const pairs = pairsOf(item.content);
    const lefts = new Set(pairs.map((pair) => pair.left));
    const rights = new Set(pairs.map((pair) => pair.right));
    const sentLefts = response.pairs.map((pair) => pair.left);

    if (new Set(sentLefts).size !== sentLefts.length) {
      return 'O mesmo item foi ligado duas vezes.';
    }

    const outside = response.pairs.some(
      (pair) => !lefts.has(pair.left) || !rights.has(pair.right),
    );

    return outside ? 'Um dos pares enviados não existe nesta questão.' : null;
  }

  return 'Tipo de questão desconhecido.';
}

// ---------------------------------------------------------------------------
// Correção
// ---------------------------------------------------------------------------

/**
 * Corrige. Assume que `responseShapeError` já devolveu `null` — com
 * formato errado, o resultado é "errou", nunca uma exceção.
 */
export function evaluateAnswer(
  item: EvaluableItem,
  response: AnswerResponse,
): Evaluation {
  if (CHOICE_TYPES.includes(item.type)) {
    return evaluateChoice(item, response);
  }

  if (TEXT_TYPES.includes(item.type)) {
    return evaluateText(item, response);
  }

  if (item.type === 'ORDER_WORDS') {
    return evaluateOrder(item, response);
  }

  return evaluateMatch(item, response);
}

function evaluateChoice(
  item: EvaluableItem,
  response: AnswerResponse,
): Evaluation {
  const options = optionsOf(item.content);
  const correctIds = correctOptionIdsOf(item.content);
  const chosen = 'optionIds' in response ? response.optionIds : [];

  const isCorrect = sameSet(chosen, correctIds);

  // O mapa de erros de questão de escolha é autorado com o **texto** da
  // alternativa errada ("I have 20 years"), não com o id.
  const errorPatterns = isCorrect
    ? []
    : uniq(
        chosen.flatMap((id) => {
          const text = options.find((option) => option.id === id)?.text;
          const pattern =
            text === undefined
              ? undefined
              : findErrorPattern(text, item.errorPatternMap);

          return pattern === undefined ? [] : [pattern];
        }),
      );

  return build(isCorrect ? 1 : 0, errorPatterns, {
    optionIds: correctIds,
    texts: correctIds.map(
      (id) => options.find((option) => option.id === id)?.text ?? id,
    ),
  });
}

function evaluateText(
  item: EvaluableItem,
  response: AnswerResponse,
): Evaluation {
  const text = 'text' in response ? response.text : '';
  const isCorrect = matchesAnswer(text, item.acceptedAnswers);

  return build(
    isCorrect ? 1 : 0,
    isCorrect ? [] : patternsFromText(text, item.errorPatternMap),
    { text: item.acceptedAnswers[0] ?? '' },
  );
}

function evaluateOrder(
  item: EvaluableItem,
  response: AnswerResponse,
): Evaluation {
  const tokens = 'tokens' in response ? response.tokens : [];
  const sentence = tokens.join(' ');
  const correctText = item.acceptedAnswers[0] ?? '';

  if (matchesAnswer(sentence, item.acceptedAnswers)) {
    return build(1, [], { text: correctText });
  }

  const given = answerVariants(sentence).map(words);
  let best = 0;

  for (const accepted of item.acceptedAnswers) {
    for (const expected of answerVariants(accepted).map(words)) {
      for (const candidate of given) {
        best = Math.max(best, orderScore(candidate, expected));
      }
    }
  }

  // Nunca 1 aqui: se fosse, o `matchesAnswer` acima já teria casado.
  return build(
    Math.min(best, 0.99),
    patternsFromText(sentence, item.errorPatternMap),
    { text: correctText },
  );
}

function evaluateMatch(
  item: EvaluableItem,
  response: AnswerResponse,
): Evaluation {
  const pairs = pairsOf(item.content);
  const sent = 'pairs' in response ? response.pairs : [];
  const expected = new Map(pairs.map((pair) => [pair.left, pair.right]));

  const hits = sent.filter(
    (pair) => expected.get(pair.left) === pair.right,
  ).length;

  // Par não enviado conta como errado: o total é o do item, não o da resposta.
  const score = pairs.length === 0 ? 0 : hits / pairs.length;

  return build(score, [], { pairs });
}

// ---------------------------------------------------------------------------
// Crédito parcial
// ---------------------------------------------------------------------------

/**
 * Nota de uma frase montada: maior subsequência comum ÷ tamanho do maior.
 *
 * Dividir pelo maior (e não pelo gabarito) impede que sobra de palavra
 * conte a favor — em ORDER_WORDS isso só aparece quando a contração muda a
 * contagem ("I'm" × "I am").
 */
export function orderScore(
  given: readonly string[],
  expected: readonly string[],
): number {
  const longest = Math.max(given.length, expected.length);

  if (longest === 0) {
    return 0;
  }

  return round2(lcsLength(given, expected) / longest);
}

function lcsLength(a: readonly string[], b: readonly string[]): number {
  let previous = new Array<number>(b.length + 1).fill(0);

  for (const wordA of a) {
    const current = new Array<number>(b.length + 1).fill(0);

    for (let j = 1; j <= b.length; j += 1) {
      current[j] =
        wordA === b[j - 1]
          ? (previous[j - 1] ?? 0) + 1
          : Math.max(previous[j] ?? 0, current[j - 1] ?? 0);
    }

    previous = current;
  }

  return previous[b.length] ?? 0;
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function build(
  rawScore: number,
  errorPatterns: string[],
  correctAnswer: CorrectAnswer,
): Evaluation {
  const score = round2(Math.max(0, Math.min(1, rawScore)));
  const isCorrect = score === 1;
  const verdict: AnswerVerdict = isCorrect
    ? 'CORRECT'
    : score > 0
      ? 'PARTIAL'
      : 'INCORRECT';

  return {
    isCorrect,
    score,
    verdict,
    feedback: feedbackFor(verdict, score),
    errorPatterns,
    correctAnswer,
  };
}

/** Tom do CLAUDE.md: direto, amigável, sem exclamação em excesso. */
export function feedbackFor(verdict: AnswerVerdict, score: number): string {
  switch (verdict) {
    case 'CORRECT':
      return 'Isso mesmo.';
    case 'PARTIAL':
      return `Quase lá: ${String(Math.round(score * 100))}% certo. Compare com a resposta.`;
    case 'INCORRECT':
      return 'Não foi dessa vez. Veja a resposta e a explicação.';
  }
}

function patternsFromText(
  text: string,
  map: Readonly<Record<string, string>>,
): string[] {
  const pattern = findErrorPattern(text, map);
  return pattern === undefined ? [] : [pattern];
}

function words(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function uniq(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);

  return left.size === right.size && [...left].every((id) => right.has(id));
}

function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  return sortedA.every((value, index) => value === sortedB[index]);
}

function record(content: unknown): Record<string, unknown> {
  return content !== null && typeof content === 'object'
    ? (content as Record<string, unknown>)
    : {};
}

function optionsOf(content: unknown): Option[] {
  const options = record(content)['options'];

  return Array.isArray(options)
    ? options.flatMap((option) => {
        const value = record(option);
        return typeof value['id'] === 'string' &&
          typeof value['text'] === 'string'
          ? [{ id: value['id'], text: value['text'] }]
          : [];
      })
    : [];
}

function correctOptionIdsOf(content: unknown): string[] {
  const ids = record(content)['correctOptionIds'];
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
}

function tokensOf(content: unknown): string[] {
  const tokens = record(content)['tokens'];
  return Array.isArray(tokens)
    ? tokens.filter((token) => typeof token === 'string')
    : [];
}

function pairsOf(content: unknown): { left: string; right: string }[] {
  const pairs = record(content)['pairs'];

  return Array.isArray(pairs)
    ? pairs.flatMap((pair) => {
        const value = record(pair);
        return typeof value['left'] === 'string' &&
          typeof value['right'] === 'string'
          ? [{ left: value['left'], right: value['right'] }]
          : [];
      })
    : [];
}
