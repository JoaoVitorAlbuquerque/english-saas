/**
 * Checagem de fatos, a parte sem IA.
 *
 * Cada frase factual do texto gerado precisa de uma `claim` com um trecho
 * copiado da fonte (`sourceQuote`). Aqui se confere o que dá para conferir
 * sem modelo: se o trecho existe **literalmente** na fonte e se sobrou frase
 * com dado (número, nome) sem claim nenhuma. Se a citação sustenta a frase é
 * a IA que diz, num passo à parte (`generator-fact-check`).
 */

export type Claim = { sentence: string; sourceQuote: string };

export type Sentence = { text: string; start: number; end: number };

/** Trecho curto demais casa com qualquer coisa e não prova nada. */
export const MIN_QUOTE_CHARS = 12;

/** Aspas, travessões e espaços variam entre a fonte e a IA; o fato, não. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function quoteInSource(quote: string, source: string): boolean {
  const needle = normalizeForMatch(quote);
  return (
    needle.length >= MIN_QUOTE_CHARS &&
    normalizeForMatch(source).includes(needle)
  );
}

/**
 * Quebra em frases por `.`, `!` e `?` seguidos de espaço ou fim. Não trata
 * toda abreviação do mundo — o texto é nosso, curto e no nível do aluno, e
 * as poucas comuns ficam de fora do corte.
 */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const pattern = /[^.!?]+(?:[.!?]+["')\]]*|$)/g;
  let pending: Sentence | null = null;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }

    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const piece: Sentence = {
      text: raw.trim(),
      start: match.index + leading,
      end: match.index + raw.trimEnd().length,
    };

    if (piece.text.length === 0) continue;

    const merged: Sentence =
      pending === null
        ? piece
        : {
            text: text.slice(pending.start, piece.end),
            start: pending.start,
            end: piece.end,
          };

    if (endsWithAbbreviation(merged.text)) {
      pending = merged;
      continue;
    }

    sentences.push(merged);
    pending = null;
  }

  if (pending !== null) {
    sentences.push(pending);
  }

  return sentences;
}

const ABBREVIATIONS =
  /\b(mr|mrs|ms|dr|st|mt|jr|sr|vs|etc|u\.s|u\.k|e\.g|i\.e|no)\.$/i;

function endsWithAbbreviation(sentence: string): boolean {
  return ABBREVIATIONS.test(sentence) || /\b[A-Z]\.$/.test(sentence);
}

/**
 * A frase traz dado checável: número ou nome próprio (maiúscula fora do
 * começo da frase, que não seja "I"). "The trip was long." não; "In 1492
 * the ships left Spain." sim.
 */
export function isFactual(sentence: string): boolean {
  if (/\d/.test(sentence)) {
    return true;
  }

  const words = sentence.split(/\s+/).slice(1);
  return words.some((word) => {
    const clean = word.replace(/^[^\p{L}]+/u, '');
    return /^\p{Lu}/u.test(clean) && !/^I(?:'|’|$)/.test(clean);
  });
}

/** A claim fala desta frase? Comparação normalizada, nos dois sentidos. */
export function claimMatchesSentence(claim: Claim, sentence: string): boolean {
  const a = normalizeForMatch(stripEndPunctuation(claim.sentence));
  const b = normalizeForMatch(stripEndPunctuation(sentence));
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

/**
 * Frases sem sustentação: as que têm uma claim reprovada e as factuais que
 * não têm claim nenhuma. `supported[i]` diz se a claim `i` passou (citação
 * literal e confirmação da IA).
 */
export function unsupportedSentences(
  text: string,
  claims: readonly Claim[],
  supported: readonly boolean[],
): Sentence[] {
  return splitSentences(text).filter((sentence) => {
    const linked = claims
      .map((claim, index) => ({ claim, index }))
      .filter(({ claim }) => claimMatchesSentence(claim, sentence.text));

    if (linked.length === 0) {
      return isFactual(sentence.text);
    }

    return linked.some(({ index }) => supported[index] !== true);
  });
}

/** Troca uma frase por outra no texto (reescrita pela IA). */
export function replaceSentence(
  text: string,
  sentence: Sentence,
  replacement: string,
): string {
  return `${text.slice(0, sentence.start)}${replacement.trim()}${text.slice(sentence.end)}`;
}

/**
 * Tira frases do texto, com o espaço que as separava. As marcações ainda
 * estão por trecho (a IA não devolve índice), então nada precisa ser
 * deslocado aqui: quem resolve os índices roda depois, sobre o texto final.
 */
export function removeSentences(
  text: string,
  sentences: readonly Sentence[],
): string {
  const ordered = [...sentences].sort((a, b) => b.start - a.start);
  let result = text;

  for (const sentence of ordered) {
    const before = result.slice(0, sentence.start);
    const after = result.slice(sentence.end);
    // Some o espaço de um dos lados — nunca os dois, para não colar frases.
    result = /^[ \t]+/.test(after)
      ? before + after.replace(/^[ \t]+/, '')
      : before.replace(/[ \t]+$/, '') + after;
  }

  return result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripEndPunctuation(text: string): string {
  return text.replace(/[.!?"')\]]+$/, '');
}
