import {
  isAboveLevel,
  lookupExact,
  wordlistSize,
  type CefrLevel,
  type WordlistEntry,
} from '@english-saas/shared';

/**
 * Checagem de nível de um texto.
 *
 * Responde: que fração das palavras está acima do nível-alvo. O prompt de
 * geração pede no máximo ~5%; aqui é onde a gente confere em vez de
 * acreditar.
 *
 * **Palavra fora da lista não conta como fora do nível.** A lista é pequena
 * hoje (ver `packages/shared/src/wordlists`) e tratar desconhecido como
 * difícil reprovaria qualquer texto. Por isso o relatório carrega
 * `coverage`: com cobertura baixa, a razão calculada não prova muita coisa,
 * e quem lê precisa saber disso.
 */

/** Números não são vocabulário a cobrar do aluno. */
const NUMERIC = /^[0-9]+$/;

/**
 * Letra solta é ruído de OCR ou sigla — menos "a" e "i", que são palavras
 * de verdade, e das mais frequentes que existem.
 */
const REAL_SINGLE_LETTER_WORDS = new Set(['a', 'i']);

function isIgnored(word: string): boolean {
  if (NUMERIC.test(word)) {
    return true;
  }

  return word.length === 1 && !REAL_SINGLE_LETTER_WORDS.has(word);
}

/** Contrações desfeitas antes da consulta. */
const CONTRACTION_PARTS: Record<string, string[]> = {
  "i'm": ['i', 'am'],
  "you're": ['you', 'are'],
  "we're": ['we', 'are'],
  "they're": ['they', 'are'],
  "he's": ['he', 'is'],
  "she's": ['she', 'is'],
  "it's": ['it', 'is'],
  "that's": ['that', 'is'],
  "there's": ['there', 'is'],
  "what's": ['what', 'is'],
  "let's": ['let', 'us'],
  "don't": ['do', 'not'],
  "doesn't": ['does', 'not'],
  "didn't": ['did', 'not'],
  "isn't": ['is', 'not'],
  "aren't": ['are', 'not'],
  "can't": ['can', 'not'],
  "won't": ['will', 'not'],
  "i've": ['i', 'have'],
  "i'll": ['i', 'will'],
};

export type LevelCheckToken = {
  word: string;
  entry?: WordlistEntry;
  aboveLevel: boolean;
};

export type LevelCheckResult = {
  /** Palavras consideradas (sem número, sigla e nome próprio). */
  totalWords: number;
  /** Quantas estavam na lista. */
  knownWords: number;
  /** Quantas estavam na lista **e** acima do nível-alvo. */
  outOfLevelCount: number;
  /** `outOfLevelCount / totalWords`. 0 quando não há palavra nenhuma. */
  ratio: number;
  /** `knownWords / totalWords`. Baixo = resultado pouco confiável. */
  coverage: number;
  /** As palavras acima do nível, sem repetição e em ordem. */
  outOfLevel: { word: string; band: CefrLevel }[];
  /** As que não estão na lista, sem repetição. Não contam na razão. */
  unknown: string[];
  /** Tamanho da lista usada, para o relatório ser interpretável. */
  wordlistSize: number;
};

/**
 * Quebra o texto em palavras, descartando nome próprio.
 *
 * Nome próprio é reconhecido por maiúscula fora do começo de frase — não é
 * perfeito ("I" cairia fora se não fosse tratado antes), mas evita que
 * "Campinas" e "Biscuit" apareçam como vocabulário avançado.
 */
export function tokenizeEnglish(text: string): string[] {
  const normalized = text.replace(/[‘’]/g, "'");
  const tokens: string[] = [];
  const pattern = /[A-Za-z][A-Za-z'-]*/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    const raw = match[0];
    const before = normalized.slice(0, match.index);
    // Começo de frase: nada antes, ou o último caractere forte foi . ! ? :
    const sentenceStart = /(^|[.!?:;]|\n)\s*$/.test(before);
    const isCapitalized = /^[A-Z]/.test(raw);
    const isPronounI = raw === 'I' || raw.startsWith("I'");

    if (isCapitalized && !sentenceStart && !isPronounI) {
      continue; // nome próprio
    }

    const word = raw.toLowerCase().replace(/^'+|'+$/g, '');

    if (word.length === 0 || isIgnored(word)) {
      continue;
    }

    const parts = CONTRACTION_PARTS[word];

    if (parts === undefined) {
      tokens.push(word);
    } else {
      tokens.push(...parts);
    }
  }

  return tokens;
}

/**
 * Consulta com morfologia simples: tenta a palavra, depois desfaz plural e
 * terminação verbal comum. Não é um lematizador — é o suficiente para
 * "lives", "living" e "friendlier" acharem "live" e "friendly".
 */
export function lookupWord(word: string): WordlistEntry | undefined {
  const direct = lookupExact(word);

  if (direct !== undefined) {
    return direct;
  }

  for (const candidate of morphologicalCandidates(word)) {
    const entry = lookupExact(candidate);

    if (entry !== undefined) {
      return entry;
    }
  }

  return undefined;
}

function morphologicalCandidates(word: string): string[] {
  const candidates: string[] = [];
  const push = (value: string) => {
    if (value.length >= 2 && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  if (word.endsWith('ies')) {
    push(`${word.slice(0, -3)}y`);
  }

  if (word.endsWith('es')) {
    push(word.slice(0, -2));
  }

  if (word.endsWith('s')) {
    push(word.slice(0, -1));
  }

  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    push(stem);
    push(`${stem}e`);
    // "running" → "run": consoante dobrada antes do sufixo.
    if (stem.length >= 2 && stem.at(-1) === stem.at(-2)) {
      push(stem.slice(0, -1));
    }
  }

  if (word.endsWith('ed')) {
    const stem = word.slice(0, -2);
    push(stem);
    push(`${stem}e`);
    if (stem.length >= 2 && stem.at(-1) === stem.at(-2)) {
      push(stem.slice(0, -1));
    }
  }

  if (word.endsWith('ily')) {
    push(`${word.slice(0, -3)}y`);
  }

  if (word.endsWith('ly')) {
    push(word.slice(0, -2));
  }

  if (word.endsWith('ier')) {
    push(`${word.slice(0, -3)}y`);
  }

  if (word.endsWith('iest')) {
    push(`${word.slice(0, -4)}y`);
  }

  if (word.endsWith('er')) {
    push(word.slice(0, -2));
  }

  if (word.endsWith('est')) {
    push(word.slice(0, -3));
  }

  return candidates;
}

export function checkLevel(text: string, target: CefrLevel): LevelCheckResult {
  const tokens = tokenizeEnglish(text);
  const outOfLevel = new Map<string, CefrLevel>();
  const unknown = new Set<string>();
  let knownWords = 0;
  let outOfLevelCount = 0;

  for (const token of tokens) {
    const entry = lookupWord(token);

    if (entry === undefined) {
      unknown.add(token);
      continue;
    }

    knownWords += 1;

    if (isAboveLevel(entry.band, target)) {
      outOfLevelCount += 1;
      outOfLevel.set(token, entry.band);
    }
  }

  const totalWords = tokens.length;

  return {
    totalWords,
    knownWords,
    outOfLevelCount,
    ratio: totalWords === 0 ? 0 : outOfLevelCount / totalWords,
    coverage: totalWords === 0 ? 1 : knownWords / totalWords,
    outOfLevel: [...outOfLevel.entries()]
      .map(([word, band]) => ({ word, band }))
      .sort((a, b) => a.word.localeCompare(b.word)),
    unknown: [...unknown].sort(),
    wordlistSize: wordlistSize(),
  };
}

/** Soma vários textos numa checagem só — uma lição inteira, por exemplo. */
export function checkLevelOfMany(
  texts: readonly string[],
  target: CefrLevel,
): LevelCheckResult {
  return checkLevel(texts.join('\n'), target);
}

/**
 * Abaixo disto a lista conheceu pouco do texto e a razão não diz muito.
 * Enquanto a lista definitiva não entra, isso dispara quase sempre.
 */
export const MIN_USEFUL_COVERAGE = 0.6;

/**
 * O texto passou do teto de palavras difíceis?
 *
 * O teto é **sobre o conjunto**, não sobre a frase: uma palavra acima do
 * nível bem contextualizada é permitida de propósito. Uma lição de 200
 * palavras com teto de 5% aguenta dez delas.
 */
export function exceedsLevelBudget(
  stats: LevelCheckResult,
  maxRatio: number,
): boolean {
  return stats.ratio > maxRatio;
}

/** A checagem de nível deste texto é confiável? */
export function hasUsefulCoverage(
  stats: LevelCheckResult,
  minCoverage = MIN_USEFUL_COVERAGE,
): boolean {
  return stats.totalWords === 0 || stats.coverage >= minCoverage;
}
