import { Injectable } from '@nestjs/common';
import { SubscriptionStatus, type PlanTier } from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';

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
import {
  grantedAccessAt,
  grantsAccess,
  planCacheTtlSeconds,
} from '../domain/subscription-state';
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

/** Teto do cache do plano. Evento de assinatura invalida antes disso. */
const PLAN_CACHE_MAX_SECONDS = 300;

/**
 * Direitos do aluno pelo plano. O tier nunca vem do JWT: é lido da
 * assinatura — cancelar ou assinar vale na hora.
 *
 * O plano fica no Redis (é lido a cada lição aberta e a cada item de
 * listagem), invalidado nos eventos de assinatura e, no máximo, no instante
 * em que uma assinatura cancelada deixa de dar acesso.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly credits: AiCreditService,
    private readonly redis: RedisService,
  ) {}

  static cacheKey(userId: string): string {
    return `billing:plan:v1:${userId}`;
  }

  /**
   * O plano que vale. Com `now` explícito calcula na hora, sem cache — é o
   * que o crédito do ciclo e os testes de "e depois do fim do período?" usam.
   */
  async currentPlan(userId: string, now?: Date): Promise<CurrentPlan> {
    if (now !== undefined) {
      return (await this.computePlan(userId, now)).plan;
    }

    const key = EntitlementsService.cacheKey(userId);
    const cached = await this.redis.client.get(key);

    if (cached !== null) {
      return JSON.parse(cached) as CurrentPlan;
    }

    const { plan, ttlSeconds } = await this.computePlan(userId, new Date());
    await this.redis.client.set(key, JSON.stringify(plan), 'EX', ttlSeconds);

    return plan;
  }

  /**
   * O plano de cada aluno num instante passado, em lote, sem cache — o
   * progresso (14) marca o plano de cada dia agregado. Aluno fora do mapa
   * era FREE.
   */
  async tiersAt(
    userIds: readonly string[],
    at: Date,
  ): Promise<Map<string, PlanTier>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const subs = await this.prisma.subscription.findMany({
      where: { userId: { in: [...userIds] }, createdAt: { lte: at } },
    });

    return bestTierByUser(subs.filter((sub) => grantedAccessAt(sub, at)));
  }

  /**
   * Assinantes e MRR por plano pago num instante (anual ÷ 12). Um aluno no
   * meio de um upgrade conta só no plano maior.
   */
  async revenueByTier(
    at: Date,
  ): Promise<{ tier: PlanTier; subscribers: number; mrrCents: number }[]> {
    const subs = (
      await this.prisma.subscription.findMany({
        where: {
          createdAt: { lte: at },
          status: {
            in: [
              SubscriptionStatus.ACTIVE,
              SubscriptionStatus.PAST_DUE,
              SubscriptionStatus.CANCELED,
            ],
          },
        },
      })
    ).filter((sub) => grantedAccessAt(sub, at));

    const best = new Map<string, (typeof subs)[number]>();
    for (const sub of subs) {
      const current = best.get(sub.userId);
      if (
        current === undefined ||
        TIER_RANK[sub.tier] > TIER_RANK[current.tier]
      ) {
        best.set(sub.userId, sub);
      }
    }

    const totals = new Map<
      PlanTier,
      { subscribers: number; mrrCents: number }
    >();
    for (const sub of best.values()) {
      const current = totals.get(sub.tier) ?? { subscribers: 0, mrrCents: 0 };
      totals.set(sub.tier, {
        subscribers: current.subscribers + 1,
        mrrCents:
          current.mrrCents +
          (sub.billingPeriod === 'YEARLY'
            ? Math.round(sub.priceCents / 12)
            : sub.priceCents),
      });
    }

    return [...totals.entries()].map(([tier, value]) => ({ tier, ...value }));
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.client.del(EntitlementsService.cacheKey(userId));
  }

  private async computePlan(
    userId: string,
    now: Date,
  ): Promise<{ plan: CurrentPlan; ttlSeconds: number }> {
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
    const ttlSeconds = planCacheTtlSeconds(subs, now, PLAN_CACHE_MAX_SECONDS);

    if (best === undefined) {
      return {
        plan: {
          tier: 'FREE',
          subscriptionId: null,
          monthlyAiCredits: await this.plans.freeMonthlyCredits(),
        },
        ttlSeconds,
      };
    }

    return {
      plan: {
        tier: best.tier,
        subscriptionId: best.id,
        monthlyAiCredits: best.plan.monthlyAiCredits,
      },
      ttlSeconds,
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

function bestTierByUser(
  subs: readonly { userId: string; tier: PlanTier }[],
): Map<string, PlanTier> {
  const best = new Map<string, PlanTier>();

  for (const sub of subs) {
    const current = best.get(sub.userId);
    if (current === undefined || TIER_RANK[sub.tier] > TIER_RANK[current]) {
      best.set(sub.userId, sub.tier);
    }
  }

  return best;
}
