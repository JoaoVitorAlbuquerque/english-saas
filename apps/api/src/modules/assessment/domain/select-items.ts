import { difficultyForP, probability, round } from './irt';
import { pickNearest } from './placement';

/**
 * Questões niveladas para o aluno.
 *
 * Para cada skill, a dificuldade-alvo é a que dá `targetP` de acerto a quem
 * tem aquele theta: com 0.7, `theta − 0.85`. Desafiador sem frustrar. As
 * skills se revezam para a lista não sair toda de uma só.
 *
 * Usada pelo planner (10), pelo SRS (9) e pelo generator (13).
 */

export const DEFAULT_TARGET_P = 0.7;

export type SelectableItem = {
  id: string;
  difficulty: number;
  exposureCount: number;
  skillIds: readonly string[];
};

export type SelectedItem = {
  itemId: string;
  skillId: string;
  difficulty: number;
  /** Chance de acerto prevista para este aluno. */
  predictedP: number;
};

export function selectLeveledItems(input: {
  candidates: readonly SelectableItem[];
  skills: readonly { skillId: string; theta: number }[];
  count: number;
  targetP?: number;
  excludeItemIds?: ReadonlySet<string>;
  random: () => number;
}): SelectedItem[] {
  const targetP = clampP(input.targetP ?? DEFAULT_TARGET_P);
  const chosen = new Set(input.excludeItemIds ?? []);
  const picked: SelectedItem[] = [];
  const exhausted = new Set<string>();

  while (picked.length < input.count && exhausted.size < input.skills.length) {
    for (const { skillId, theta } of input.skills) {
      if (picked.length >= input.count) break;
      if (exhausted.has(skillId)) continue;

      const pool = input.candidates.filter(
        (item) => !chosen.has(item.id) && item.skillIds.includes(skillId),
      );
      const item = pickNearest(
        pool,
        difficultyForP(theta, targetP),
        input.random,
      );

      if (item === null) {
        exhausted.add(skillId);
        continue;
      }

      chosen.add(item.id);
      picked.push({
        itemId: item.id,
        skillId,
        difficulty: item.difficulty,
        predictedP: round(probability(theta, item.difficulty), 3),
      });
    }
  }

  return picked;
}

/** Fora de (0.05, 0.95) o alvo não faz sentido pedagógico e o logit explode. */
function clampP(p: number): number {
  return Math.min(0.95, Math.max(0.05, p));
}
