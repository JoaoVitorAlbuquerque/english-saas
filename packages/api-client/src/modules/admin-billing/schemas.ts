import {
  BONUS_LIMITS,
  CREDIT_COST_MAX,
  CREDIT_COST_MIN,
  CREDIT_FEATURES,
  PLAN_LIMITS,
  creditFeatureSchema,
  grantBonusSchema,
  updatePlanSchema,
} from '@english-saas/shared';
import { z } from 'zod';

import { planViewSchema } from '../billing/schemas';

/**
 * Espelha `admin/billing` (módulo 11, somente ADMIN): planos, custo dos
 * créditos e bônus. Os limites dos formulários vêm de `packages/shared` —
 * a API valida com os mesmos schemas.
 */

export {
  BONUS_LIMITS,
  CREDIT_COST_MAX,
  CREDIT_COST_MIN,
  CREDIT_FEATURES,
  PLAN_LIMITS,
  creditFeatureSchema,
  grantBonusSchema,
  updatePlanSchema,
};
export type {
  CreditFeatureName,
  GrantBonus,
  UpdatePlan,
} from '@english-saas/shared';

export const adminPlanListSchema = z.array(planViewSchema);

/** Custo em créditos por feature (só as que gastam crédito). */
export const creditCostsResponseSchema = z.object({
  costs: z.record(z.string(), z.number()),
});
export type CreditCostsResponse = z.infer<typeof creditCostsResponseSchema>;

export const grantBonusResponseSchema = z.object({ balance: z.number() });
export type GrantBonusResponse = z.infer<typeof grantBonusResponseSchema>;
