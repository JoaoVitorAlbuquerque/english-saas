import { apiFetch } from '../../http/fetch-client';
import { planViewSchema, type PlanView } from '../billing/schemas';
import {
  adminPlanListSchema,
  creditCostsResponseSchema,
  grantBonusResponseSchema,
  grantBonusSchema,
  updatePlanSchema,
  type CreditCostsResponse,
  type CreditFeatureName,
  type GrantBonus,
  type GrantBonusResponse,
  type UpdatePlan,
} from './schemas';

const BASE = '/admin/billing';

/** Todos os planos, inclusive os fora de venda. */
export async function listPlans(): Promise<PlanView[]> {
  return apiFetch(`${BASE}/plans`, { schema: adminPlanListSchema });
}

/** Só o que veio no corpo muda. Preço novo não mexe em quem já assina. */
export async function updatePlan(
  id: string,
  patch: UpdatePlan,
): Promise<PlanView> {
  return apiFetch(`${BASE}/plans/${id}`, {
    method: 'PATCH',
    body: updatePlanSchema.parse(patch),
    schema: planViewSchema,
  });
}

export async function getCreditCosts(): Promise<CreditCostsResponse> {
  return apiFetch(`${BASE}/credit-costs`, {
    schema: creditCostsResponseSchema,
  });
}

/** O custo novo vale na hora, para todo mundo. */
export async function updateCreditCost(
  feature: CreditFeatureName,
  cost: number,
): Promise<CreditCostsResponse> {
  return apiFetch(`${BASE}/credit-costs/${feature}`, {
    method: 'PATCH',
    body: { cost },
    schema: creditCostsResponseSchema,
  });
}

/** O motivo fica no extrato do aluno e na auditoria. */
export async function grantBonus(
  userId: string,
  input: GrantBonus,
): Promise<GrantBonusResponse> {
  return apiFetch(`${BASE}/users/${userId}/credits/bonus`, {
    method: 'POST',
    body: grantBonusSchema.parse(input),
    schema: grantBonusResponseSchema,
  });
}
