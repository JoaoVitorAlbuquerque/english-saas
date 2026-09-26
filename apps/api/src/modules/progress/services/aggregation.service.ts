import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type PlanTier } from '@prisma/client';
import type { AvailabilityMinutes } from '@english-saas/shared';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AiUsageService } from 'src/modules/ai/services/ai-usage.service';
import { EntitlementsService } from 'src/modules/billing/services/entitlements.service';
import { LearningActivityService } from 'src/modules/learning/services/learning-activity.service';
import { ReviewLogService } from 'src/modules/srs/services/review-log.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  buildDailyActivity,
  isActive,
  type DailyActivity,
} from '../domain/activity';
import {
  addDays,
  dateRange,
  localDateOf,
  localDayBounds,
  weekStart,
  weekdayKey,
} from '../domain/dates';
import {
  abandonmentFunnel,
  activeUsers,
  cohortRetention,
  STALL_DAYS,
} from '../domain/platform';

/** Alunos por lote: cabe num `IN (...)` sem esticar a consulta. */
const USER_BATCH = 500;
/** Coortes recalculadas a cada noite. */
export const COHORT_WEEKS = 12;
const PLAN_TIERS: PlanTier[] = ['FREE', 'BASE', 'PLUS'];
const DAY_MS = 86_400_000;

export type StudyContext = {
  userId: string;
  timezone: string;
  availabilityMinutes: AvailabilityMinutes;
  createdAt: Date;
};

export type UserDay = DailyActivity & {
  userId: string;
  date: string;
  tier: PlanTier;
  active: boolean;
};

/**
 * O job noturno do progresso. Lê o que cada módulo conta (pelos serviços
 * deles) e grava as tabelas diárias.
 *
 * **Tudo é reprocessável**: cada passo apaga o que havia para aquele dia e
 * grava de novo, então rodar duas vezes dá o mesmo resultado e um backfill
 * é só chamar `aggregateRange` com o intervalo.
 *
 * O dia do aluno é o dia **no fuso dele**; o dia das métricas de plataforma
 * (lição, custo, plano, cadastro) é o do `METRICS_TIMEZONE`.
 */
@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly users: UsersService,
    private readonly learning: LearningActivityService,
    private readonly reviews: ReviewLogService,
    private readonly aiUsage: AiUsageService,
    private readonly entitlements: EntitlementsService,
  ) {}

  get metricsTimeZone(): string {
    return this.env.get('METRICS_TIMEZONE');
  }

  /** O dia de hoje no fuso das métricas. */
  today(now = new Date()): string {
    return localDateOf(now, this.metricsTimeZone);
  }

  /** Reprocessa `[from, to]` (datas) e as coortes até `to`. */
  async aggregateRange(from: string, to: string): Promise<void> {
    for (const date of dateRange(from, to)) {
      await this.aggregateDay(date);
    }

    await this.aggregateCohorts(to);
    this.logger.log({ from, to }, 'Agregação do progresso concluída');
  }

  /** Um dia: aluno → lição → custo e plano → plataforma (lê os anteriores). */
  async aggregateDay(date: string): Promise<void> {
    await this.aggregateUsers(date);
    await this.aggregateLessons(date);
    await this.aggregateCostAndPlans(date);
    await this.aggregatePlatform(date);
  }

  // -------------------------------------------------------------------
  // Aluno
  // -------------------------------------------------------------------

  async aggregateUsers(date: string): Promise<void> {
    const aiCache = new Map<string, Promise<Map<string, AiDay>>>();
    let afterId: string | undefined;

    for (;;) {
      const page = await this.users.studyContexts({
        afterId,
        take: USER_BATCH,
      });

      if (page.length === 0) {
        break;
      }

      const days = await this.buildUserDays(page, date, aiCache);
      const rows = days.filter((day) => day.active || day.plannedMinutes > 0);
      const dbDay = toDbDate(date);

      await this.prisma.$transaction([
        this.prisma.userDailyActivity.deleteMany({
          where: { date: dbDay, userId: { in: page.map((c) => c.userId) } },
        }),
        this.prisma.userDailyActivity.createMany({
          data: rows.map((day) => toActivityRow(day, dbDay)),
        }),
      ]);

      afterId = page.at(-1)?.userId;

      if (page.length < USER_BATCH) {
        break;
      }
    }
  }

  /**
   * O dia de cada aluno, calculado na hora. É o que o job grava — e o que
   * `GET /me/progress` usa para mostrar o "hoje" antes do job passar.
   */
  async buildUserDays(
    contexts: readonly StudyContext[],
    date: string,
    aiCache = new Map<string, Promise<Map<string, AiDay>>>(),
  ): Promise<UserDay[]> {
    const byZone = new Map<string, StudyContext[]>();

    for (const context of contexts) {
      const { end } = localDayBounds(date, context.timezone);
      // Conta criada depois do dia: nada a contar, nem planejado.
      if (context.createdAt.getTime() >= end.getTime()) continue;

      const group = byZone.get(context.timezone) ?? [];
      group.push(context);
      byZone.set(context.timezone, group);
    }

    const days: UserDay[] = [];

    for (const [timezone, group] of byZone) {
      const { start, end } = localDayBounds(date, timezone);
      const ids = group.map((context) => context.userId);
      const aiKey = `${start.toISOString()}|${end.toISOString()}`;
      const aiPromise = aiCache.get(aiKey) ?? this.aiByUser(start, end);
      aiCache.set(aiKey, aiPromise);

      const [learning, reviews, ai, tiers] = await Promise.all([
        this.learning.activityByUser(ids, start, end),
        this.reviews.countsByUser(ids, start, end),
        aiPromise,
        this.entitlements.tiersAt(ids, new Date(end.getTime() - 1)),
      ]);

      const learningBy = new Map(learning.map((row) => [row.userId, row]));
      const reviewsBy = new Map(reviews.map((row) => [row.userId, row]));
      const weekday = weekdayKey(date);

      for (const context of group) {
        const study = learningBy.get(context.userId);
        const review = reviewsBy.get(context.userId);
        const usage = ai.get(context.userId);
        const activity = buildDailyActivity({
          stepTimeMs: study?.stepTimeMs ?? 0,
          practiceAnswerMs: study?.practiceAnswerMs ?? 0,
          lessonsStarted: study?.lessonsStarted ?? 0,
          lessonsCompleted: study?.lessonsCompleted ?? 0,
          answers: study?.answers ?? 0,
          firstTryAnswers: study?.firstTryAnswers ?? 0,
          firstTryCorrect: study?.firstTryCorrect ?? 0,
          byCompetency: study?.byCompetency ?? {},
          reviewsDone: review?.reviews ?? 0,
          flashcardReviews: review?.flashcards ?? 0,
          aiCalls: usage?.calls ?? 0,
          aiCostUsdMicros: usage?.costUsdMicros ?? 0,
          plannedMinutes: context.availabilityMinutes[weekday],
        });

        days.push({
          ...activity,
          userId: context.userId,
          date,
          tier: tiers.get(context.userId) ?? 'FREE',
          active: isActive(activity),
        });
      }
    }

    return days;
  }

  private async aiByUser(start: Date, end: Date): Promise<Map<string, AiDay>> {
    const rows = await this.aiUsage.costByUserAndFeature(start, end);
    const byUser = new Map<string, AiDay>();

    for (const row of rows) {
      if (row.userId === null) continue;

      const current = byUser.get(row.userId) ?? { calls: 0, costUsdMicros: 0 };
      byUser.set(row.userId, {
        calls: current.calls + row.calls,
        costUsdMicros: current.costUsdMicros + row.costUsdMicros,
      });
    }

    return byUser;
  }

  // -------------------------------------------------------------------
  // Lições
  // -------------------------------------------------------------------

  async aggregateLessons(date: string): Promise<void> {
    const { start, end } = localDayBounds(date, this.metricsTimeZone);
    const stallMs = STALL_DAYS * DAY_MS;

    const [activity, stalled] = await Promise.all([
      this.learning.lessonActivity(start, end),
      // Parada há exatamente STALL_DAYS dias ao fim deste dia: conta aqui,
      // uma vez só.
      this.learning.stalledAttempts(
        new Date(start.getTime() - stallMs),
        new Date(end.getTime() - stallMs),
      ),
    ]);

    const funnel = abandonmentFunnel(stalled);
    const lessonIds = new Set([
      ...activity.map((row) => row.lessonId),
      ...funnel.keys(),
    ]);
    const activityBy = new Map(activity.map((row) => [row.lessonId, row]));
    const dbDay = toDbDate(date);

    await this.prisma.$transaction([
      this.prisma.lessonDailyMetric.deleteMany({ where: { date: dbDay } }),
      this.prisma.lessonDailyMetric.createMany({
        data: [...lessonIds].map((lessonId) => {
          const row = activityBy.get(lessonId);
          const dropoff = funnel.get(lessonId);

          return {
            date: dbDay,
            lessonId,
            started: row?.started ?? 0,
            completed: row?.completed ?? 0,
            firstTryAnswers: row?.firstTryAnswers ?? 0,
            firstTryCorrect: row?.firstTryCorrect ?? 0,
            abandoned: dropoff?.abandoned ?? 0,
            abandonedByStep: (dropoff?.byStep ??
              []) as unknown as Prisma.InputJsonValue,
          };
        }),
      }),
    ]);
  }

  // -------------------------------------------------------------------
  // Custo de IA e planos
  // -------------------------------------------------------------------

  async aggregateCostAndPlans(date: string): Promise<void> {
    const { start, end } = localDayBounds(date, this.metricsTimeZone);
    const at = new Date(end.getTime() - 1);
    const costs = await this.aiUsage.costByUserAndFeature(start, end);
    const userIds = [
      ...new Set(
        costs.flatMap((row) => (row.userId === null ? [] : [row.userId])),
      ),
    ];
    const [tiers, revenue, activeRows] = await Promise.all([
      this.entitlements.tiersAt(userIds, at),
      this.entitlements.revenueByTier(at),
      this.prisma.userDailyActivity.groupBy({
        by: ['tier'],
        where: { date: toDbDate(date), active: true },
        _count: { _all: true },
      }),
    ]);

    const groups = new Map<
      string,
      {
        feature: string;
        tier: PlanTier | null;
        calls: number;
        cacheHits: number;
        costUsdMicros: number;
        users: Set<string>;
      }
    >();

    for (const row of costs) {
      const tier =
        row.userId === null ? null : (tiers.get(row.userId) ?? 'FREE');
      const key = `${row.feature}|${tier ?? ''}`;
      const group = groups.get(key) ?? {
        feature: row.feature,
        tier,
        calls: 0,
        cacheHits: 0,
        costUsdMicros: 0,
        users: new Set<string>(),
      };
      group.calls += row.calls;
      group.cacheHits += row.cacheHits;
      group.costUsdMicros += row.costUsdMicros;
      if (row.userId !== null) group.users.add(row.userId);
      groups.set(key, group);
    }

    const costByTier = new Map<PlanTier, number>();
    for (const group of groups.values()) {
      if (group.tier === null) continue;
      costByTier.set(
        group.tier,
        (costByTier.get(group.tier) ?? 0) + group.costUsdMicros,
      );
    }

    const revenueBy = new Map(revenue.map((row) => [row.tier, row]));
    const activeBy = new Map(
      activeRows.map((row) => [row.tier, row._count._all]),
    );
    const dbDay = toDbDate(date);

    await this.prisma.$transaction([
      this.prisma.aiCostDailyMetric.deleteMany({ where: { date: dbDay } }),
      this.prisma.aiCostDailyMetric.createMany({
        data: [...groups.values()].map((group) => ({
          date: dbDay,
          feature: group.feature,
          tier: group.tier,
          calls: group.calls,
          cacheHits: group.cacheHits,
          costUsdMicros: group.costUsdMicros,
          users: group.users.size,
        })),
      }),
      this.prisma.planDailyMetric.deleteMany({ where: { date: dbDay } }),
      this.prisma.planDailyMetric.createMany({
        data: PLAN_TIERS.map((tier) => ({
          date: dbDay,
          tier,
          activeSubscribers: revenueBy.get(tier)?.subscribers ?? 0,
          mrrCents: revenueBy.get(tier)?.mrrCents ?? 0,
          activeUsers: activeBy.get(tier) ?? 0,
          aiCostUsdMicros: costByTier.get(tier) ?? 0,
        })),
      }),
    ]);
  }

  // -------------------------------------------------------------------
  // Plataforma e coortes
  // -------------------------------------------------------------------

  async aggregatePlatform(date: string): Promise<void> {
    const { start, end } = localDayBounds(date, this.metricsTimeZone);
    const dbDay = toDbDate(date);

    const [activeDays, signups, lessons, cost] = await Promise.all([
      this.prisma.userDailyActivity.findMany({
        where: {
          active: true,
          date: { gte: toDbDate(addDays(date, -29)), lte: dbDay },
        },
        select: { userId: true, date: true },
      }),
      this.users.signupsBetween(start, end),
      this.prisma.lessonDailyMetric.aggregate({
        where: { date: dbDay },
        _sum: { started: true, completed: true },
      }),
      this.prisma.aiCostDailyMetric.aggregate({
        where: { date: dbDay },
        _sum: { costUsdMicros: true },
      }),
    ]);

    const counts = activeUsers(
      activeDays.map((row) => ({
        userId: row.userId,
        date: fromDbDate(row.date),
      })),
      date,
    );
    const data = {
      ...counts,
      newUsers: signups.length,
      lessonsStarted: lessons._sum.started ?? 0,
      lessonsCompleted: lessons._sum.completed ?? 0,
      aiCostUsdMicros: cost._sum.costUsdMicros ?? 0,
    };

    await this.prisma.dailyPlatformMetric.upsert({
      where: { date: dbDay },
      create: { date: dbDay, ...data },
      update: data,
    });
  }

  /** Recalcula as últimas `COHORT_WEEKS` coortes semanais até `date`. */
  async aggregateCohorts(date: string): Promise<void> {
    const zone = this.metricsTimeZone;
    const currentWeek = weekStart(date);
    const firstWeek = addDays(currentWeek, -7 * (COHORT_WEEKS - 1));
    const signups = await this.users.signupsBetween(
      localDayBounds(firstWeek, zone).start,
      localDayBounds(date, zone).end,
    );
    const active = await this.prisma.userDailyActivity.findMany({
      where: {
        active: true,
        userId: { in: signups.map((signup) => signup.userId) },
        date: { gte: toDbDate(firstWeek), lte: toDbDate(date) },
      },
      select: { userId: true, date: true },
    });

    const cells = cohortRetention({
      signups: signups.map((signup) => ({
        userId: signup.userId,
        cohortWeek: weekStart(localDateOf(signup.createdAt, zone)),
      })),
      activeWeeks: active.map((row) => ({
        userId: row.userId,
        week: weekStart(fromDbDate(row.date)),
      })),
      currentWeek,
    });

    await this.prisma.$transaction([
      this.prisma.cohortRetention.deleteMany({
        where: { cohortWeek: { gte: toDbDate(firstWeek) } },
      }),
      this.prisma.cohortRetention.createMany({
        data: cells.map((cell) => ({
          cohortWeek: toDbDate(cell.cohortWeek),
          weekOffset: cell.weekOffset,
          cohortSize: cell.cohortSize,
          retained: cell.retained,
        })),
      }),
    ]);
  }
}

type AiDay = { calls: number; costUsdMicros: number };

/** `YYYY-MM-DD` → valor de coluna `@db.Date` (meia-noite UTC). */
export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Coluna `@db.Date` → `YYYY-MM-DD`. */
export function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toActivityRow(day: UserDay, date: Date) {
  return {
    userId: day.userId,
    date,
    lessonSeconds: day.lessonSeconds,
    practiceSeconds: day.practiceSeconds,
    reviewSeconds: day.reviewSeconds,
    studySeconds: day.studySeconds,
    lessonsStarted: day.lessonsStarted,
    lessonsCompleted: day.lessonsCompleted,
    answers: day.answers,
    firstTryAnswers: day.firstTryAnswers,
    firstTryCorrect: day.firstTryCorrect,
    byCompetency: day.byCompetency as Prisma.InputJsonValue,
    reviewsDone: day.reviewsDone,
    plannedMinutes: day.plannedMinutes,
    aiCalls: day.aiCalls,
    aiCostUsdMicros: day.aiCostUsdMicros,
    tier: day.tier,
    active: day.active,
  };
}
