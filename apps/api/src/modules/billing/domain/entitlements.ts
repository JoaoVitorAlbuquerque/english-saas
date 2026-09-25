/**
 * O que cada plano libera. Função pura — o tier efetivo entra pronto.
 *
 * Tipos espelham os enums do Prisma (mesmos literais), sem importar
 * `@prisma/client` aqui dentro.
 */

export type PlanTier = 'FREE' | 'BASE' | 'PLUS';

export type Feature =
  | 'LESSON_ACCESS'
  | 'TUTOR_CORRECTION'
  | 'TUTOR_ROLEPLAY'
  | 'GENERATOR_TOPIC'
  | 'GENERATOR_INGEST'
  | 'PDF_DOWNLOAD';

/** Features que dependem de contexto (qual unidade) e não servem pro guard. */
export type ContextualFeature = 'LESSON_ACCESS';
export type GuardableFeature = Exclude<Feature, ContextualFeature>;

export type LessonAccessContext = {
  /** Posição da unidade dentro do nível, a partir de 0. */
  unitIndexInLevel: number;
};

export const TIER_RANK: Record<PlanTier, number> = {
  FREE: 0,
  BASE: 1,
  PLUS: 2,
};

/** FREE só vê a primeira unidade de cada nível; BASE e PLUS, tudo. */
export function canAccessLesson(
  tier: PlanTier,
  context: LessonAccessContext,
): boolean {
  return tier !== 'FREE' || context.unitIndexInLevel === 0;
}

/**
 * Se o plano oferece a feature. Não olha saldo: o tutor existe no FREE (com
 * cota pequena) — quem barra o uso de verdade é o crédito, na reserva.
 */
export function canUseFeature(
  tier: PlanTier,
  feature: GuardableFeature,
): boolean {
  switch (feature) {
    case 'TUTOR_CORRECTION':
    case 'TUTOR_ROLEPLAY':
      return true;
    case 'GENERATOR_TOPIC':
    case 'GENERATOR_INGEST':
      return tier === 'PLUS';
    case 'PDF_DOWNLOAD':
      return tier !== 'FREE';
  }
}

export function highestTier(tiers: readonly PlanTier[]): PlanTier {
  return tiers.reduce<PlanTier>(
    (best, tier) => (TIER_RANK[tier] > TIER_RANK[best] ? tier : best),
    'FREE',
  );
}
