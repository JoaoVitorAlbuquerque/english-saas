import type { CefrLevel } from '@english-saas/shared';

import { shiftLevel } from './level-profile';

/**
 * Calibração do nível pelo que o aluno diz dos materiais.
 *
 * O nível do material parte do modelo do aluno (7). Se os últimos materiais
 * vieram "difíceis demais" com frequência, o próximo desce um degrau; se
 * vieram "fáceis demais", sobe. Só um degrau, e só com sinal repetido — uma
 * avaliação isolada não muda nada.
 */

export type DifficultyFeedback = 'TOO_EASY' | 'OK' | 'TOO_HARD';

/** Quantas avaliações recentes contam. */
export const CALIBRATION_WINDOW = 5;
/** Saldo de "fácil" menos "difícil" que move o nível. */
export const CALIBRATION_THRESHOLD = 2;

/** -1, 0 ou +1. `recent` vem do mais novo para o mais antigo. */
export function levelBias(
  recent: readonly (DifficultyFeedback | null)[],
): -1 | 0 | 1 {
  const window = recent
    .filter((entry): entry is DifficultyFeedback => entry !== null)
    .slice(0, CALIBRATION_WINDOW);
  const balance = window.reduce(
    (sum, entry) =>
      sum + (entry === 'TOO_EASY' ? 1 : entry === 'TOO_HARD' ? -1 : 0),
    0,
  );

  if (balance >= CALIBRATION_THRESHOLD) return 1;
  if (balance <= -CALIBRATION_THRESHOLD) return -1;
  return 0;
}

export function materialLevel(
  learnerLevel: CefrLevel,
  bias: -1 | 0 | 1,
): CefrLevel {
  return shiftLevel(learnerLevel, bias);
}

/** Nota da avaliação → sinal de interesse do modelo do aluno. */
export function ratingSignal(
  rating: number,
): 'MATERIAL_RATED_HIGH' | 'MATERIAL_RATED_LOW' | null {
  if (rating >= 4) return 'MATERIAL_RATED_HIGH';
  if (rating <= 2) return 'MATERIAL_RATED_LOW';
  return null;
}
