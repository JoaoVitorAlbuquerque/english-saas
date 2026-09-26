import { isIP } from 'node:net';

import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';

import { checkLevel } from 'src/modules/content-studio/domain/level-check';

import { splitSentences } from './claims';

/**
 * Regras do conteúdo que o aluno manda: que link a gente aceita, se o texto
 * é inglês, de que nível ele é e quanto dele pode aparecer copiado no
 * material (direito autoral de letra de música).
 */

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

export const SOCIAL_PLATFORMS = {
  YOUTUBE: ['youtube.com', 'youtu.be'],
  INSTAGRAM: ['instagram.com'],
  FACEBOOK: ['facebook.com', 'fb.watch'],
  TIKTOK: ['tiktok.com'],
} as const;

export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

export type UrlClass =
  | { kind: 'ARTICLE'; url: URL }
  | { kind: 'SOCIAL'; platform: SocialPlatform; url: URL }
  | { kind: 'INVALID'; reason: string };

/**
 * Artigo, rede social ou recusado. Rede social nunca é baixada: vale só
 * como referência, e o aluno cola a transcrição.
 */
export function classifyUrl(raw: string): UrlClass {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    return { kind: 'INVALID', reason: 'não é um endereço válido' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'INVALID', reason: 'só aceitamos links http ou https' };
  }

  if (url.username !== '' || url.password !== '') {
    return { kind: 'INVALID', reason: 'link com usuário e senha' };
  }

  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    return { kind: 'INVALID', reason: 'porta fora do padrão' };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { kind: 'INVALID', reason: 'endereço interno' };
  }

  const literal = host.replace(/^\[|\]$/g, '');
  if (isIP(literal) !== 0 && isPrivateAddress(literal)) {
    return { kind: 'INVALID', reason: 'endereço interno' };
  }

  for (const [platform, domains] of Object.entries(SOCIAL_PLATFORMS)) {
    if (
      domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    ) {
      return { kind: 'SOCIAL', platform: platform as SocialPlatform, url };
    }
  }

  return { kind: 'ARTICLE', url };
}

/**
 * Endereço que não pode ser buscado a pedido do aluno (SSRF): rede
 * privada, loopback, link-local (inclui o metadata da nuvem, 169.254…),
 * CGNAT, multicast e reservados. Vale para IPv4, IPv6 e IPv4 dentro de
 * IPv6.
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    return isPrivateIpv4(address);
  }

  if (version !== 6) {
    return true; // não é IP: quem chamou errou, então recusa
  }

  const lower = address.toLowerCase();
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);

  if (mapped?.[1] !== undefined) {
    return isPrivateIpv4(mapped[1]);
  }

  const first = parseInt(lower.split(':')[0] || '0', 16);

  return (
    lower === '::' ||
    lower === '::1' ||
    (first & 0xfe00) === 0xfc00 || // fc00::/7 — unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 — link-local
    (first & 0xff00) === 0xff00 || // ff00::/8 — multicast
    lower.startsWith('64:ff9b:') || // NAT64
    lower.startsWith('2001:db8:') // documentação
  );
}

function isPrivateIpv4(address: string): boolean {
  const [a = 0, b = 0] = address.split('.').map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

// ---------------------------------------------------------------------------
// Idioma e nível
// ---------------------------------------------------------------------------

/**
 * Palavras gramaticais do inglês que não existem em português nem em
 * espanhol ("a", "as", "no", "do" ficam de fora de propósito). Um texto em
 * inglês tem uma boa parte delas; um em português, quase nenhuma.
 */
// prettier-ignore
const ENGLISH_FUNCTION_WORDS = new Set([
  'the', 'and', 'of', 'to', 'in', 'is', 'was', 'it', 'you', 'that', 'he',
  'she', 'they', 'we', 'for', 'on', 'with', 'are', 'were', 'this', 'but',
  'have', 'has', 'had', 'not', 'at', 'by', 'from', 'his', 'her', 'their',
  'what', 'which', 'be', 'will', 'would', 'can', 'there', 'an', 'or', 'my',
  'your', 'i', "i'm", "it's", "don't", 'our', 'who', 'been', 'if', 'when',
  'all', 'just', 'about', 'so', 'into', 'out', 'up', 'them', 'him', 'me',
]);

/** Acima disto o texto é tratado como inglês. */
export const ENGLISH_SIGNAL_THRESHOLD = 0.15;

/** Fração das palavras que são palavras gramaticais do inglês. */
export function englishSignal(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .match(/[\p{L}']+/gu);

  if (words === null || words.length === 0) {
    return 0;
  }

  const hits = words.filter((word) => ENGLISH_FUNCTION_WORDS.has(word)).length;
  return hits / words.length;
}

export function looksEnglish(text: string): boolean {
  return englishSignal(text) >= ENGLISH_SIGNAL_THRESHOLD;
}

/** Tamanho médio de frase típico de cada nível (teto). */
const SENTENCE_LENGTH_BY_LEVEL: [CefrLevel, number][] = [
  ['A1', 9],
  ['A2', 13],
  ['B1', 18],
  ['B2', 23],
];

/**
 * Nível aproximado do texto original: o maior entre o que o vocabulário
 * indica (menor nível em que ≤ 5% das palavras ficam acima) e o que o
 * tamanho médio de frase indica. É informativo — vai para o prompt e para
 * o aluno, não trava nada.
 */
export function estimateLevel(text: string, maxOutOfLevel = 0.05): CefrLevel {
  const byVocabulary =
    CEFR_LEVELS.find(
      (level) => checkLevel(text, level).ratio <= maxOutOfLevel,
    ) ?? 'C1';

  const sentences = splitSentences(text);
  const averageWords =
    sentences.length === 0
      ? 0
      : sentences.reduce(
          (sum, sentence) => sum + sentence.text.split(/\s+/).length,
          0,
        ) / sentences.length;
  const byLength =
    SENTENCE_LENGTH_BY_LEVEL.find(([, max]) => averageWords <= max)?.[0] ??
    'C1';

  return CEFR_LEVELS.indexOf(byVocabulary) >= CEFR_LEVELS.indexOf(byLength)
    ? byVocabulary
    : byLength;
}

// ---------------------------------------------------------------------------
// Cópia literal
// ---------------------------------------------------------------------------

/** Maior trecho literal que um material pode copiar de uma letra de música. */
export const MAX_VERBATIM_WORDS = 12;
/** Soma dos trechos copiados (de 6+ palavras) que o material inteiro aguenta. */
export const MAX_TOTAL_VERBATIM_WORDS = 25;
/** Abaixo disto, coincidência é só frase comum ("I love you so much"). */
export const MIN_COUNTED_RUN = 6;

function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .match(/[\p{L}\p{N}']+/gu) ?? []
  );
}

/**
 * Maior sequência de palavras de `candidate` que aparece, na mesma ordem e
 * colada, em `source`. Programação dinâmica de substring comum sobre
 * palavras.
 */
export function longestVerbatimRun(candidate: string, source: string): number {
  const a = words(candidate);
  const b = words(source);
  let best = 0;
  let previous = new Array<number>(b.length + 1).fill(0);

  for (const word of a) {
    const current = new Array<number>(b.length + 1).fill(0);

    for (let j = 1; j <= b.length; j += 1) {
      if (word === b[j - 1]) {
        const length = (previous[j - 1] ?? 0) + 1;
        current[j] = length;
        if (length > best) best = length;
      }
    }

    previous = current;
  }

  return best;
}

/**
 * Frases do material que copiam demais da letra: cada uma acima do teto,
 * e depois as maiores até a soma caber no orçamento do texto inteiro.
 */
export function overCopiedSentences<T extends { text: string }>(
  sentences: readonly T[],
  source: string,
): T[] {
  const runs = sentences.map((sentence) => ({
    sentence,
    run: longestVerbatimRun(sentence.text, source),
  }));

  const removed = runs.filter(({ run }) => run > MAX_VERBATIM_WORDS);
  const kept = runs
    .filter(({ run }) => run <= MAX_VERBATIM_WORDS && run >= MIN_COUNTED_RUN)
    .sort((a, b) => b.run - a.run);
  let total = kept.reduce((sum, { run }) => sum + run, 0);

  for (const entry of kept) {
    if (total <= MAX_TOTAL_VERBATIM_WORDS) break;
    removed.push(entry);
    total -= entry.run;
  }

  return removed.map(({ sentence }) => sentence);
}
