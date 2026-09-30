import { z } from 'zod';

/**
 * Espelha `apps/api/src/modules/billing/{controllers/billing.controller.ts,
 * services/plans.service.ts,services/subscription.service.ts,
 * services/ai-credit.service.ts}` — módulo 11, ainda sem export em
 * `packages/shared`.
 */

export const PLAN_TIERS = ['FREE', 'BASE', 'PLUS'] as const;
export const planTierSchema = z.enum(PLAN_TIERS);
export type PlanTier = z.infer<typeof planTierSchema>;

export const BILLING_PERIODS = ['MONTHLY', 'YEARLY'] as const;
export const billingPeriodSchema = z.enum(BILLING_PERIODS);
export type BillingPeriod = z.infer<typeof billingPeriodSchema>;

export const PAYMENT_METHODS = ['PIX', 'BOLETO', 'CREDIT_CARD'] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const SUBSCRIPTION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED',
] as const;
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const planViewSchema = z.object({
  id: z.string(),
  tier: planTierSchema,
  billingPeriod: billingPeriodSchema.nullable(),
  priceCents: z.number(),
  priceLabel: z.string(),
  monthlyAiCredits: z.number(),
  active: z.boolean(),
});
export type PlanView = z.infer<typeof planViewSchema>;

export const checkoutRequestSchema = z.object({
  tier: z.enum(['BASE', 'PLUS']),
  billingPeriod: billingPeriodSchema,
  paymentMethod: paymentMethodSchema,
  cpfCnpj: z
    .string()
    .regex(/^(\d{11}|\d{14})$/, 'Informe só os números do CPF ou CNPJ.')
    .optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const subscriptionDetailSchema = z.object({
  id: z.string(),
  tier: planTierSchema,
  billingPeriod: billingPeriodSchema,
  status: subscriptionStatusSchema,
  priceCents: z.number(),
  priceLabel: z.string(),
  paymentMethod: paymentMethodSchema,
  checkoutUrl: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  accessUntil: z.string().nullable(),
  canceledAt: z.string().nullable(),
});
export type SubscriptionDetail = z.infer<typeof subscriptionDetailSchema>;

export const subscriptionOverviewSchema = z.object({
  tier: planTierSchema,
  message: z.string(),
  subscription: subscriptionDetailSchema.nullable(),
});
export type SubscriptionOverview = z.infer<typeof subscriptionOverviewSchema>;

export const creditCostsSchema = z.record(z.string(), z.number());

export const creditsBalanceSchema = z.object({
  tier: planTierSchema,
  balance: z.number(),
  monthlyAiCredits: z.number(),
  costs: creditCostsSchema,
});
export type CreditsBalance = z.infer<typeof creditsBalanceSchema>;

export const CREDIT_ENTRY_KINDS = [
  'GRANT',
  'CONSUME',
  'REFUND',
  'BONUS',
] as const;
export const creditEntryKindSchema = z.enum(CREDIT_ENTRY_KINDS);

export const creditLedgerEntrySchema = z.object({
  id: z.string(),
  kind: creditEntryKindSchema,
  amount: z.number(),
  feature: z.string().nullable(),
  reason: z.string().nullable(),
  cycleKey: z.string().nullable(),
  createdAt: z.string(),
});
export type CreditLedgerEntry = z.infer<typeof creditLedgerEntrySchema>;

export const creditsHistoryPageSchema = z.object({
  data: z.array(creditLedgerEntrySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type CreditsHistoryPage = z.infer<typeof creditsHistoryPageSchema>;
