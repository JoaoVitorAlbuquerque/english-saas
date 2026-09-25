import { Injectable } from '@nestjs/common';
import { SubscriptionStatus, type PlanTier } from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  AI_CREDIT_COSTS,
  isCreditFeature,
  remainingUses,
} from '../domain/credits';
import {
  canAccessLesson,
  canUseFeature,
  type Feature,
  type GuardableFeature,
  TIER_RANK,
  type LessonAccessContext,
} from '../domain/entitlements';
import { grantsAccess } from '../domain/subscription-state';
import { AiCreditService } from './ai-credit.service';
import { PlansService } from './plans.service';

export type CurrentPlan = {
  tier: PlanTier;
  /** Assinatura que dá esse tier; nula no FREE. */
  subscriptionId: string | null;
  monthlyAiCredits: number;
};

export type Quota = {
  feature: Feature;
  tier: PlanTier;
  allowed: boolean;
  /** Custo por uso; 0 em feature que não gasta crédito. */
  creditCost: number;
  balance: number;
  monthlyAiCredits: number;
  /** Quantos usos o saldo ainda paga; nulo em feature sem crédito. */
  remainingUses: number | null;
};

/**
 * Direitos do aluno pelo plano. O tier nunca vem do JWT: é lido da
 * assinatura a cada checagem — cancelar ou assinar vale na hora.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly credits: AiCreditService,
  ) {}

  async currentPlan(userId: string, now = new Date()): Promise<CurrentPlan> {
    const subs = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.CANCELED,
          ],
        },
      },
      include: { plan: { select: { monthlyAiCredits: true } } },
    });

    const best = subs
      .filter((sub) => grantsAccess(sub, now))
      .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])[0];

    if (best === undefined) {
      return {
        tier: 'FREE',
        subscriptionId: null,
        monthlyAiCredits: await this.plans.freeMonthlyCredits(),
      };
    }

    return {
      tier: best.tier,
      subscriptionId: best.id,
      monthlyAiCredits: best.plan.monthlyAiCredits,
    };
  }

  async can(userId: string, feature: GuardableFeature): Promise<boolean> {
    const { tier } = await this.currentPlan(userId);
    return canUseFeature(tier, feature);
  }

  async canAccessLesson(
    userId: string,
    context: LessonAccessContext,
  ): Promise<boolean> {
    const { tier } = await this.currentPlan(userId);
    return canAccessLesson(tier, context);
  }

  async getQuota(userId: string, feature: Feature): Promise<Quota> {
    const [plan, balance] = await Promise.all([
      this.currentPlan(userId),
      this.credits.balanceFor(userId),
    ]);
    const credit = isCreditFeature(feature);

    return {
      feature,
      tier: plan.tier,
      // Acesso a lição depende da unidade: aqui "pode" = o plano tem lição.
      allowed: feature === 'LESSON_ACCESS' || canUseFeature(plan.tier, feature),
      creditCost: credit ? AI_CREDIT_COSTS[feature] : 0,
      balance,
      monthlyAiCredits: plan.monthlyAiCredits,
      remainingUses: credit ? remainingUses(balance, feature) : null,
    };
  }
}
