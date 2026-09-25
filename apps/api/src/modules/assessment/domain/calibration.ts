import { MAX_DIFFICULTY, MIN_DIFFICULTY } from '@english-saas/shared';

import { round } from './irt';

/**
 * Calibração de dificuldade, uma vez por semana.
 *
 * Estimativa Rasch aproximada: se quem respondeu tem habilidade média θ̄ e
 * acertou numa taxa p̂, a dificuldade que explica isso é θ̄ − logit(p̂).
 *
 * **Atualização lenta**: anda 30% da diferença e no máximo 0.5 logit por
 * rodada. Uma semana de turma atípica não pode mover um item de faixa.
 *
 * A habilidade usada é a **atual** de quem respondeu, não a do momento da
 * resposta — quem melhorou desde então faz o item parecer um pouco mais
 * fácil. É uma aproximação consciente (ver CLAUDE.md, assessment).
 */

export const CALIBRATION_RULES = {
  minResponses: 50,
  step: 0.3,
  maxShift: 0.5,
  tooEasy: 0.95,
  tooHard: 0.1,
  minPointBiserial: 0.2,
} as const;

export type CalibrationFlag = 'TOO_EASY' | 'TOO_HARD' | 'LOW_DISCRIMINATION';

export type CalibrationResult = {
  responses: number;
  pValue: number;
  estimatedDifficulty: number;
  appliedDifficulty: number;
  pointBiserial: number | null;
  flags: CalibrationFlag[];
};

export function calibrateItem(input: {
  currentDifficulty: number;
  responses: readonly { ability: number; correct: boolean }[];
}): CalibrationResult | null {
  const n = input.responses.length;

  if (n < CALIBRATION_RULES.minResponses) {
    return null;
  }

  const correct = input.responses.filter((response) => response.correct).length;
  const pValue = correct / n;
  // Sem isso, 100% de acerto daria logit infinito.
  const bounded = Math.min(1 - 1 / (2 * n), Math.max(1 / (2 * n), pValue));
  const meanAbility =
    input.responses.reduce((sum, response) => sum + response.ability, 0) / n;

  const estimated = clamp(meanAbility - Math.log(bounded / (1 - bounded)));
  const shift = Math.max(
    -CALIBRATION_RULES.maxShift,
    Math.min(
      CALIBRATION_RULES.maxShift,
      CALIBRATION_RULES.step * (estimated - input.currentDifficulty),
    ),
  );
  const pointBiserial = pointBiserialOf(input.responses);

  const flags: CalibrationFlag[] = [];
  if (pValue > CALIBRATION_RULES.tooEasy) flags.push('TOO_EASY');
  if (pValue < CALIBRATION_RULES.tooHard) flags.push('TOO_HARD');
  if (
    pointBiserial !== null &&
    pointBiserial < CALIBRATION_RULES.minPointBiserial
  ) {
    flags.push('LOW_DISCRIMINATION');
  }

  return {
    responses: n,
    pValue: round(pValue, 4),
    estimatedDifficulty: round(estimated, 4),
    appliedDifficulty: round(clamp(input.currentDifficulty + shift), 4),
    pointBiserial: pointBiserial === null ? null : round(pointBiserial, 4),
    flags,
  };
}

/**
 * Correlação entre acertar (0/1) e a habilidade de quem respondeu. Item que
 * discrimina bem é acertado mais por quem sabe mais. Sem variação em um dos
 * lados, a correlação não existe — devolve `null` em vez de inventar.
 */
export function pointBiserialOf(
  responses: readonly { ability: number; correct: boolean }[],
): number | null {
  const n = responses.length;
  if (n < 2) return null;

  const xs: number[] = responses.map((response) => (response.correct ? 1 : 0));
  const ys = responses.map((response) => response.ability);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let index = 0; index < n; index += 1) {
    const dx = (xs[index] ?? 0) - meanX;
    const dy = (ys[index] ?? 0) - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) return null;

  return cov / Math.sqrt(varX * varY);
}

function clamp(value: number): number {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, value));
}
