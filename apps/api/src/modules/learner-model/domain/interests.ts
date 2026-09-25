import { MAX_INTEREST_WEIGHT, MIN_INTEREST_WEIGHT } from '@english-saas/shared';

/**
 * Interesse aprendido pelo uso.
 *
 * O aluno escolhe os primeiros no onboarding; daqui em diante o peso sobe
 * quando ele gera, conclui ou avalia bem um material sobre o tema, e desce
 * quando abandona ou avalia mal. Quem emite esses sinais é o generator (13)
 * — até lá, esta regra só é chamada pelo serviço.
 */

export const INTEREST_SIGNALS = {
  MATERIAL_GENERATED: 5,
  MATERIAL_COMPLETED: 8,
  MATERIAL_RATED_HIGH: 10,
  MATERIAL_RATED_LOW: -5,
  MATERIAL_ABANDONED: -5,
} as const;

export type InterestSignal = keyof typeof INTEREST_SIGNALS;

/** Tema que o sistema descobre sozinho começa discreto. */
export const LEARNED_INTEREST_START = 30;

/**
 * Peso novo, ou `null` para não gravar nada.
 *
 * Sinal negativo sobre tema que o aluno nunca teve não cria o tema — não
 * faz sentido registrar desinteresse por algo que ele nunca pediu.
 */
export function applyInterestSignal(
  current: number | null,
  signal: InterestSignal,
): number | null {
  const delta = INTEREST_SIGNALS[signal];

  if (current === null) {
    return delta > 0 ? clamp(LEARNED_INTEREST_START + delta) : null;
  }

  return clamp(current + delta);
}

function clamp(weight: number): number {
  return Math.min(
    MAX_INTEREST_WEIGHT,
    Math.max(MIN_INTEREST_WEIGHT, Math.round(weight)),
  );
}
