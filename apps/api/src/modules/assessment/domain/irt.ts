/**
 * Teoria de resposta ao item — modelo de Rasch (1 parâmetro).
 *
 * P(acerto | theta, b) = 1 / (1 + e^-(theta − b)). Mesma escala logit da
 * dificuldade dos itens e do theta do learner-model.
 *
 * A estimativa é **EAP** (esperança a posteriori) por quadratura, não
 * máxima verossimilhança: com todas as respostas certas — comum nos
 * primeiros itens — a verossimilhança não tem máximo finito e a MV foge
 * para o infinito. A priori resolve isso, e o desvio da posteriori já é o
 * erro padrão.
 */

export const QUADRATURE = { min: -4, max: 4, step: 0.1 } as const;

export type Response = { difficulty: number; correct: boolean };

export type Estimate = { theta: number; standardError: number };

export type Prior = { mean: number; sd: number };

const GRID: readonly number[] = Array.from(
  {
    length: Math.round((QUADRATURE.max - QUADRATURE.min) / QUADRATURE.step) + 1,
  },
  (_, index) => round(QUADRATURE.min + index * QUADRATURE.step, 6),
);

export function probability(theta: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(theta - difficulty)));
}

/** Dificuldade que dá `p` de acerto a quem tem `theta`. */
export function difficultyForP(theta: number, p: number): number {
  return theta - Math.log(p / (1 - p));
}

/**
 * EAP: média e desvio da posteriori sobre uma grade de −4 a 4.
 *
 * Trabalha em log para 30 itens não virarem produto de números minúsculos.
 */
export function estimateEap(
  responses: readonly Response[],
  prior: Prior,
): Estimate {
  const logWeights = GRID.map((theta) => {
    let log = -0.5 * ((theta - prior.mean) / prior.sd) ** 2;

    for (const response of responses) {
      const p = probability(theta, response.difficulty);
      log += Math.log(response.correct ? p : 1 - p);
    }

    return log;
  });

  const peak = Math.max(...logWeights);
  const weights = logWeights.map((log) => Math.exp(log - peak));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const mean =
    weights.reduce(
      (sum, weight, index) => sum + weight * (GRID[index] ?? 0),
      0,
    ) / total;
  const variance =
    weights.reduce(
      (sum, weight, index) => sum + weight * ((GRID[index] ?? 0) - mean) ** 2,
      0,
    ) / total;

  return {
    theta: round(mean, 4),
    standardError: round(Math.sqrt(variance), 4),
  };
}

/** Informação de Fisher de um item em theta: p(1 − p). Máxima em p = 0.5. */
export function information(theta: number, difficulty: number): number {
  const p = probability(theta, difficulty);
  return p * (1 - p);
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
