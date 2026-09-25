import { BillingPeriod, PlanTier, type PrismaClient } from '@prisma/client';

import type { SeedModule } from './seed-module';

type SeedPlan = {
  tier: PlanTier;
  billingPeriod: BillingPeriod | null;
  priceCents: number;
  monthlyAiCredits: number;
};

const plusCredits = Number(process.env['AI_MONTHLY_CREDITS_PLUS'] ?? 500);

/**
 * Preços e cotas de partida. Depois do primeiro seed quem manda é o admin
 * (`PATCH /admin/billing/plans/:id`) — o seed só cria o que falta, nunca
 * sobrescreve um preço editado.
 */
export const BILLING_PLANS: SeedPlan[] = [
  {
    tier: PlanTier.FREE,
    billingPeriod: null,
    priceCents: 0,
    monthlyAiCredits: 10,
  },
  {
    tier: PlanTier.BASE,
    billingPeriod: BillingPeriod.MONTHLY,
    priceCents: 3_990,
    monthlyAiCredits: 100,
  },
  {
    tier: PlanTier.BASE,
    billingPeriod: BillingPeriod.YEARLY,
    priceCents: 39_900,
    monthlyAiCredits: 100,
  },
  {
    tier: PlanTier.PLUS,
    billingPeriod: BillingPeriod.MONTHLY,
    priceCents: 6_990,
    monthlyAiCredits: plusCredits,
  },
  {
    tier: PlanTier.PLUS,
    billingPeriod: BillingPeriod.YEARLY,
    priceCents: 69_900,
    monthlyAiCredits: plusCredits,
  },
];

export const billingSeed: SeedModule = {
  name: '11 billing',
  async run(prisma: PrismaClient): Promise<void> {
    for (const plan of BILLING_PLANS) {
      // `billingPeriod` nulo não serve de chave única no upsert do Prisma.
      const existing = await prisma.subscriptionPlan.findFirst({
        where: { tier: plan.tier, billingPeriod: plan.billingPeriod },
        select: { id: true },
      });

      if (existing === null) {
        await prisma.subscriptionPlan.create({ data: plan });
      }
    }
  },
};
