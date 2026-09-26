import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';

/**
 * Como o texto de um material deve ser em cada nível: tamanho, frase e o que
 * a gramática pode usar. É a "config por nível" do generator — vai para o
 * prompt e volta na validação do que a IA entregou.
 */
export type LevelProfile = {
  minWords: number;
  maxWords: number;
  /** Frase mais longa aceitável, em palavras. */
  maxSentenceWords: number;
  /** Orientação de gramática para o prompt (em inglês, é instrução à IA). */
  grammarGuide: string;
};

export const LEVEL_PROFILES: Record<CefrLevel, LevelProfile> = {
  A1: {
    minWords: 80,
    maxWords: 120,
    maxSentenceWords: 10,
    grammarGuide:
      'Very short sentences. Present simple and "to be"; past simple only when the target structures ask for it. No subordinate clauses.',
  },
  A2: {
    minWords: 120,
    maxWords: 180,
    maxSentenceWords: 14,
    grammarGuide:
      'Short sentences. Present and past simple, "there was/were", "going to". Simple connectors: and, but, because, then.',
  },
  B1: {
    minWords: 250,
    maxWords: 350,
    maxSentenceWords: 20,
    grammarGuide:
      'Clear sentences. All simple tenses, present perfect, past continuous, basic passive, relative clauses with who/which/that.',
  },
  B2: {
    minWords: 350,
    maxWords: 450,
    maxSentenceWords: 26,
    grammarGuide:
      'Natural prose. Perfect tenses, passive voice, reported speech, conditionals, a wider range of connectors.',
  },
  C1: {
    minWords: 450,
    maxWords: 600,
    maxSentenceWords: 32,
    grammarGuide:
      'Rich, idiomatic prose. Any structure, including inversion, cleft sentences and nuanced modals.',
  },
};

/**
 * Folga na checagem de tamanho: a IA não conta palavra com precisão, e dez
 * palavras a mais num texto A2 não mudam o nível dele.
 */
export const WORD_COUNT_TOLERANCE = 0.2;

export function levelIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

/** Sobe ou desce `delta` degraus, sem sair de A1–C1. */
export function shiftLevel(level: CefrLevel, delta: number): CefrLevel {
  const index = Math.min(
    CEFR_LEVELS.length - 1,
    Math.max(0, levelIndex(level) + delta),
  );
  return CEFR_LEVELS[index] ?? level;
}

/** Os níveis de A1 até `level`, inclusive. */
export function levelsUpTo(level: CefrLevel): CefrLevel[] {
  return CEFR_LEVELS.slice(0, levelIndex(level) + 1);
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * O tamanho cabe no nível? No material de um conteúdo do aluno (INGEST) o
 * piso não vale: um texto colado de 60 palavras não rende um resumo de 120
 * sem inventar — e inventar é pior que ficar curto.
 */
export function wordCountIssue(
  words: number,
  profile: LevelProfile,
  options: { enforceMinimum: boolean },
): 'TOO_SHORT' | 'TOO_LONG' | null {
  if (words > Math.ceil(profile.maxWords * (1 + WORD_COUNT_TOLERANCE))) {
    return 'TOO_LONG';
  }

  if (
    options.enforceMinimum &&
    words < Math.floor(profile.minWords * (1 - WORD_COUNT_TOLERANCE))
  ) {
    return 'TOO_SHORT';
  }

  return null;
}
