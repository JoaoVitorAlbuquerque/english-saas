import { CEFR_LEVELS, type CefrLevel } from '../cefr';
import { EN_WORDLIST_ENTRIES, EN_WORDLIST_SOURCES } from './en.generated';

/**
 * Lista de frequência por banda CEFR.
 *
 * É o que sustenta a checagem de nível do content-studio: dado um texto e um
 * nível-alvo, quantas palavras estão acima dele.
 *
 * **A lista atual é pequena e provisória.** Ela cobre o A1 da unidade 1 e
 * pouco mais. Enquanto for assim, `unknown` (palavra que não está na lista)
 * é bem maior que `outOfLevel`, e é por isso que a checagem reporta
 * `coverage` junto: um resultado com cobertura baixa não prova nada. A lista
 * definitiva entra pelo CSV em `packages/shared/data/` — veja
 * `scripts/import-wordlist.ts`.
 */

export type WordlistEntry = {
  word: string;
  band: CefrLevel;
  rank: number;
};

export type WordlistSource = {
  key: string;
  name: string;
  license: string;
  url: string;
};

export { EN_WORDLIST_SOURCES };

const LEVEL_ORDER: Record<CefrLevel, number> = Object.fromEntries(
  CEFR_LEVELS.map((level, index) => [level, index]),
) as Record<CefrLevel, number>;

/** `B1` vem depois de `A2`. Comparação por posição na progressão. */
export function compareLevels(a: CefrLevel, b: CefrLevel): number {
  return LEVEL_ORDER[a] - LEVEL_ORDER[b];
}

export function isAboveLevel(band: CefrLevel, target: CefrLevel): boolean {
  return compareLevels(band, target) > 0;
}

const index = new Map<string, WordlistEntry>(
  EN_WORDLIST_ENTRIES.map(([word, band, rank]) => [word, { word, band, rank }]),
);

/** A entrada exata, sem tentar morfologia. */
export function lookupExact(word: string): WordlistEntry | undefined {
  return index.get(word.toLowerCase());
}

export function wordlistSize(): number {
  return index.size;
}

export function wordlistBandCounts(): Record<CefrLevel, number> {
  const counts = Object.fromEntries(
    CEFR_LEVELS.map((level) => [level, 0]),
  ) as Record<CefrLevel, number>;

  for (const entry of index.values()) {
    counts[entry.band] += 1;
  }

  return counts;
}
