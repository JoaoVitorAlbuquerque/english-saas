import { z } from 'zod';

/**
 * Contratos das telas de gestão do admin (alunos, planos, auditoria).
 * A API valida com estes schemas e o formulário do painel usa os mesmos
 * limites — um lugar só.
 */

// ---------------------------------------------------------------------------
// Créditos de IA
// ---------------------------------------------------------------------------

/** Features que gastam crédito (o resto do enum `Feature` só liga/desliga). */
export const CREDIT_FEATURES = [
  'TUTOR_CORRECTION',
  'TUTOR_ROLEPLAY',
  'GENERATOR_TOPIC',
  'GENERATOR_INGEST',
] as const;
export const creditFeatureSchema = z.enum(CREDIT_FEATURES);
export type CreditFeatureName = z.infer<typeof creditFeatureSchema>;

/** Piso 1: custo zero deixaria a IA de graça e sem teto. */
export const CREDIT_COST_MIN = 1;
export const CREDIT_COST_MAX = 100;

export const creditCostValueSchema = z
  .number()
  .int()
  .min(CREDIT_COST_MIN)
  .max(CREDIT_COST_MAX);

export const BONUS_LIMITS = {
  amountMin: 1,
  amountMax: 10_000,
  reasonMax: 200,
} as const;

export const grantBonusSchema = z.object({
  amount: z
    .number()
    .int()
    .min(BONUS_LIMITS.amountMin)
    .max(BONUS_LIMITS.amountMax),
  reason: z.string().trim().min(1).max(BONUS_LIMITS.reasonMax),
});
export type GrantBonus = z.infer<typeof grantBonusSchema>;

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export const PLAN_LIMITS = {
  priceCentsMax: 10_000_000,
  monthlyAiCreditsMax: 100_000,
} as const;

export const updatePlanSchema = z
  .object({
    priceCents: z
      .number()
      .int()
      .min(0)
      .max(PLAN_LIMITS.priceCentsMax)
      .optional(),
    monthlyAiCredits: z
      .number()
      .int()
      .min(0)
      .max(PLAN_LIMITS.monthlyAiCreditsMax)
      .optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para alterar.',
  });
export type UpdatePlan = z.infer<typeof updatePlanSchema>;

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

/** Toda ação de ADMIN que deixa rastro. Ação nova entra aqui e na tela. */
export const AUDIT_ACTIONS = [
  'credits.bonus',
  'plan.update',
  'credit-cost.update',
  'metrics.rebuild',
  'student.view',
] as const;
export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const AUDIT_TARGET_TYPES = [
  'user',
  'plan',
  'credit_cost',
  'metrics',
] as const;
export const auditTargetTypeSchema = z.enum(AUDIT_TARGET_TYPES);
export type AuditTargetType = z.infer<typeof auditTargetTypeSchema>;
