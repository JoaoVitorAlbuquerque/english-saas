import type { MaterialSummary } from '@english-saas/api-client';
import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';

export type LevelPoint = { id: string; level: CefrLevel; createdAt: string };

export type LevelEvolution = {
  /** Do mais antigo para o mais novo. */
  points: LevelPoint[];
  first: CefrLevel | null;
  latest: CefrLevel | null;
  /** Degraus CEFR entre o primeiro e o último material (negativo = desceu). */
  steps: number;
};

/**
 * A lista chega do mais novo para o mais antigo (`GET /me/materials`); a
 * evolução se lê do mais antigo para o mais novo.
 */
export function levelEvolution(
  materials: readonly MaterialSummary[],
): LevelEvolution {
  const points = [...materials]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, level, createdAt }) => ({ id, level, createdAt }));
  const first = points[0]?.level ?? null;
  const latest = points.at(-1)?.level ?? null;

  return {
    points,
    first,
    latest,
    steps:
      first === null || latest === null
        ? 0
        : CEFR_LEVELS.indexOf(latest) - CEFR_LEVELS.indexOf(first),
  };
}
