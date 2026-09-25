import type { FsrsRating } from './fsrs';

/**
 * Rating a partir de uma resposta objetiva (card de SKILL).
 *
 * Errou → Again. Certo com dica ou lento → Hard. Certo → Good. Certo, sem
 * dica, rápido e com sequência → Easy. Os cards de VOCAB/CHUNK/REGISTER_NOTE
 * /ERROR_PATTERN não passam por aqui — o aluno se auto-avalia direto.
 */

export const RATING_THRESHOLDS = {
  /** Acima disso, "lento" — mesmo acertando, não veio automático. */
  slowMs: 15_000,
  /** Abaixo disso, "rápido" — candidato a Easy. */
  fastMs: 4_000,
  /** Sequência mínima de acertos para Easy. */
  easyStreak: 2,
} as const;

export function ratingFromAnswer(
  input: {
    isCorrect: boolean;
    hintsUsed: number;
    responseTimeMs: number;
    correctStreak: number;
  },
  thresholds: typeof RATING_THRESHOLDS = RATING_THRESHOLDS,
): FsrsRating {
  if (!input.isCorrect) {
    return 'AGAIN';
  }

  if (input.hintsUsed > 0 || input.responseTimeMs > thresholds.slowMs) {
    return 'HARD';
  }

  if (
    input.responseTimeMs < thresholds.fastMs &&
    input.correctStreak >= thresholds.easyStreak
  ) {
    return 'EASY';
  }

  return 'GOOD';
}
