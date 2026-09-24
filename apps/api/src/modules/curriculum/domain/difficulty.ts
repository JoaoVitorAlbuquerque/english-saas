import {
  INITIAL_DIFFICULTY_BY_LEVEL,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  type CefrLevel,
} from '@english-saas/shared';

/**
 * Dificuldade de item, em logit.
 *
 * Zero é o aluno mediano de B1. Um item com dificuldade igual à habilidade
 * do aluno dá 50% de chance de acerto. A calibração de verdade vem das
 * tentativas (módulo 8) — aqui é só o ponto de partida.
 */

/** Valor inicial derivado do nível, quando o autor não informa. */
export function initialDifficulty(level: CefrLevel): number {
  return INITIAL_DIFFICULTY_BY_LEVEL[level];
}

/** Fora da faixa o item não separa mais ninguém: prende nas bordas. */
export function clampDifficulty(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, MIN_DIFFICULTY), MAX_DIFFICULTY);
}

/**
 * Dificuldade final de um item: a informada pelo autor, se veio, senão a
 * derivada do nível. Sempre dentro da faixa.
 */
export function resolveDifficulty(
  level: CefrLevel,
  provided?: number | null,
): number {
  return clampDifficulty(
    provided === undefined || provided === null
      ? initialDifficulty(level)
      : provided,
  );
}

/** Rótulo pt-BR para o painel de autoria. */
export function difficultyLabel(value: number): string {
  if (value <= -1.5) return 'Muito fácil';
  if (value <= -0.5) return 'Fácil';
  if (value < 0.5) return 'Média';
  if (value < 1.5) return 'Difícil';
  return 'Muito difícil';
}
