import { Injectable } from '@nestjs/common';
import {
  PlanTier,
  type BillingPeriod,
  type SubscriptionPlan,
} from '@prisma/client';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import { PlanNotAvailableError } from '../billing.errors';
import { priceLabel } from '../domain/pricing';

export type PlanView = {
  id: string;
  tier: PlanTier;
  billingPeriod: BillingPeriod | null;
  priceCents: number;
  priceLabel: string;
  monthlyAiCredits: number;
  active: boolean;
};

export type PlanPatch = {
  priceCents?: number | undefined;
  monthlyAiCredits?: number | undefined;
  active?: boolean | undefined;
};

const TIER_ORDER: Record<PlanTier, number> = { FREE: 0, BASE: 1, PLUS: 2 };

export function toPlanView(plan: SubscriptionPlan): PlanView {
  return {
    id: plan.id,
    tier: plan.tier,
    billingPeriod: plan.billingPeriod,
    priceCents: plan.priceCents,
    priceLabel: priceLabel(plan.priceCents, plan.billingPeriod),
    monthlyAiCredits: plan.monthlyAiCredits,
    active: plan.active,
  };
}

/** Catálogo de planos — config em banco, editável pelo admin. */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: { activeOnly: boolean }): Promise<PlanView[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: options.activeOnly ? { active: true } : {},
    });

    return plans
      .sort(
        (a, b) =>
          TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
          (a.billingPeriod ?? '').localeCompare(b.billingPeriod ?? ''),
      )
      .map(toPlanView);
  }

  /** Plano pago à venda. FREE não se assina. */
  async findPurchasable(
    tier: PlanTier,
    billingPeriod: BillingPeriod,
  ): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { tier_billingPeriod: { tier, billingPeriod } },
    });

    if (plan === null || !plan.active || plan.tier === PlanTier.FREE) {
      throw new PlanNotAvailableError();
    }

    return plan;
  }

  /** Cota do FREE. Sem o plano semeado, zero — ninguém recebe crédito à toa. */
  async freeMonthlyCredits(): Promise<number> {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { tier: PlanTier.FREE },
      select: { monthlyAiCredits: true },
    });

    return plan?.monthlyAiCredits ?? 0;
  }

  async get(id: string): Promise<PlanView> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (plan === null) {
      throw new NotFoundError('Plano não encontrado.');
    }

    return toPlanView(plan);
  }

  async update(id: string, patch: PlanPatch): Promise<PlanView> {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (existing === null) {
      throw new NotFoundError('Plano não encontrado.');
    }

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(patch.priceCents === undefined
          ? {}
          : { priceCents: patch.priceCents }),
        ...(patch.monthlyAiCredits === undefined
          ? {}
          : { monthlyAiCredits: patch.monthlyAiCredits }),
        ...(patch.active === undefined ? {} : { active: patch.active }),
      },
    });

    return toPlanView(plan);
  }
}
