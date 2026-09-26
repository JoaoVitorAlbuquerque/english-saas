import { Injectable } from '@nestjs/common';
import type { PlanTier } from '@prisma/client';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CalibrationService } from 'src/modules/assessment/services/calibration.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { UsersService } from 'src/modules/users/services/users.service';

import { addDays, daysBetween } from '../domain/dates';
import {
  mergeDropoffs,
  rankLesson,
  usdMicrosToBrlCents,
  worstLessons,
  type LessonTotals,
  type StepDropoff,
} from '../domain/platform';
import {
  AggregationService,
  fromDbDate,
  toDbDate,
} from './aggregation.service';

const TOP_AI_USERS = 20;
const FLAGGED_ITEMS = 50;
const PLAN_TIERS: PlanTier[] = ['FREE', 'BASE', 'PLUS'];

/**
 * `GET /admin/metrics`. Só lê e soma as tabelas diárias — nenhuma conta
 * pesada no request. O que não passou pelo job (hoje) não aparece: o
 * intervalo termina, por padrão, ontem.
 *
 * Exceção consciente: os itens problemáticos vêm direto da calibração
 * semanal (8), que já é o resultado agregado.
 */
@Injectable()
export class AdminMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly aggregation: AggregationService,
    private readonly users: UsersService,
    private readonly catalog: CatalogService,
    private readonly calibration: CalibrationService,
  ) {}

  /** Intervalo padrão: os 30 dias até ontem, no fuso das métricas. */
  defaultRange(now = new Date()): { from: string; to: string } {
    const to = addDays(this.aggregation.today(now), -1);
    return { from: addDays(to, -29), to };
  }

  async get(from: string, to: string) {
    const range = { gte: toDbDate(from), lte: toDbDate(to) };

    const [activity, retention, lessons, flagged, aiCost, plans, topUsers] =
      await Promise.all([
        this.prisma.dailyPlatformMetric.findMany({
          where: { date: range },
          orderBy: { date: 'asc' },
        }),
        this.prisma.cohortRetention.findMany({
          orderBy: [{ cohortWeek: 'asc' }, { weekOffset: 'asc' }],
        }),
        this.prisma.lessonDailyMetric.findMany({ where: { date: range } }),
        this.calibration.listFlagged({ limit: FLAGGED_ITEMS }),
        this.prisma.aiCostDailyMetric.findMany({ where: { date: range } }),
        this.prisma.planDailyMetric.findMany({
          where: { date: range },
          orderBy: { date: 'asc' },
        }),
        this.prisma.userDailyActivity.groupBy({
          by: ['userId'],
          where: { date: range, aiCostUsdMicros: { gt: 0 } },
          _sum: { aiCostUsdMicros: true, aiCalls: true },
          orderBy: { _sum: { aiCostUsdMicros: 'desc' } },
          take: TOP_AI_USERS,
        }),
      ]);

    const rate = this.env.get('USD_BRL_RATE');
    const latest = activity.at(-1);

    return {
      period: { from, to, days: daysBetween(from, to) + 1 },
      activity: {
        dau: latest?.dau ?? 0,
        wau: latest?.wau ?? 0,
        mau: latest?.mau ?? 0,
        daily: activity.map((row) => ({
          date: fromDbDate(row.date),
          dau: row.dau,
          wau: row.wau,
          mau: row.mau,
          newUsers: row.newUsers,
          lessonsStarted: row.lessonsStarted,
          lessonsCompleted: row.lessonsCompleted,
        })),
      },
      retention: this.retentionMatrix(retention),
      lessons: await this.lessonSection(lessons),
      items: flagged.data,
      aiCost: await this.aiCostSection(aiCost, topUsers, rate),
      revenue: this.revenueSection(plans, rate),
    };
  }

  private retentionMatrix(
    rows: readonly {
      cohortWeek: Date;
      weekOffset: number;
      cohortSize: number;
      retained: number;
    }[],
  ) {
    const cohorts = new Map<
      string,
      {
        cohortWeek: string;
        size: number;
        weeks: { offset: number; retained: number; rate: number | null }[];
      }
    >();

    for (const row of rows) {
      const week = fromDbDate(row.cohortWeek);
      const cohort = cohorts.get(week) ?? {
        cohortWeek: week,
        size: row.cohortSize,
        weeks: [],
      };
      cohort.weeks.push({
        offset: row.weekOffset,
        retained: row.retained,
        rate:
          row.cohortSize === 0
            ? null
            : Math.round((row.retained / row.cohortSize) * 1000) / 1000,
      });
      cohorts.set(week, cohort);
    }

    return [...cohorts.values()];
  }

  private async lessonSection(
    rows: readonly {
      lessonId: string;
      started: number;
      completed: number;
      firstTryAnswers: number;
      firstTryCorrect: number;
      abandoned: number;
      abandonedByStep: unknown;
    }[],
  ) {
    const totals = new Map<string, LessonTotals>();
    const dropoffs = new Map<string, StepDropoff[][]>();

    for (const row of rows) {
      const current = totals.get(row.lessonId) ?? {
        lessonId: row.lessonId,
        started: 0,
        completed: 0,
        firstTryAnswers: 0,
        firstTryCorrect: 0,
        abandoned: 0,
      };
      totals.set(row.lessonId, {
        lessonId: row.lessonId,
        started: current.started + row.started,
        completed: current.completed + row.completed,
        firstTryAnswers: current.firstTryAnswers + row.firstTryAnswers,
        firstTryCorrect: current.firstTryCorrect + row.firstTryCorrect,
        abandoned: current.abandoned + row.abandoned,
      });
      dropoffs.set(row.lessonId, [
        ...(dropoffs.get(row.lessonId) ?? []),
        row.abandonedByStep as StepDropoff[],
      ]);
    }

    const titles = new Map(
      (await this.catalog.publishedCoursePath()).map((lesson) => [
        lesson.lessonId,
        lesson.title,
      ]),
    );
    const all = [...totals.values()];
    const started = all.reduce((sum, lesson) => sum + lesson.started, 0);
    const completed = all.reduce((sum, lesson) => sum + lesson.completed, 0);
    const withTitle = <T extends { lessonId: string }>(lesson: T) => ({
      ...lesson,
      title: titles.get(lesson.lessonId) ?? null,
    });

    return {
      started,
      completed,
      completionRate:
        started === 0 ? null : Math.round((completed / started) * 1000) / 1000,
      abandoned: all.reduce((sum, lesson) => sum + lesson.abandoned, 0),
      abandonmentByStep: mergeDropoffs([...dropoffs.values()].flat()),
      byLesson: all
        .map((lesson) => ({
          ...withTitle(rankLesson(lesson)),
          abandonmentByStep: mergeDropoffs(dropoffs.get(lesson.lessonId) ?? []),
        }))
        .sort((a, b) => b.started - a.started),
      worst: worstLessons(all).map(withTitle),
    };
  }

  private async aiCostSection(
    rows: readonly {
      feature: string;
      tier: PlanTier | null;
      calls: number;
      cacheHits: number;
      costUsdMicros: number;
    }[],
    topUsers: readonly {
      userId: string;
      _sum: { aiCostUsdMicros: number | null; aiCalls: number | null };
    }[],
    rate: number,
  ) {
    const sum = <K extends string>(key: (row: (typeof rows)[number]) => K) => {
      const totals = new Map<
        K,
        { calls: number; cacheHits: number; costUsdMicros: number }
      >();
      for (const row of rows) {
        const current = totals.get(key(row)) ?? {
          calls: 0,
          cacheHits: 0,
          costUsdMicros: 0,
        };
        totals.set(key(row), {
          calls: current.calls + row.calls,
          cacheHits: current.cacheHits + row.cacheHits,
          costUsdMicros: current.costUsdMicros + row.costUsdMicros,
        });
      }
      return [...totals.entries()]
        .map(([name, value]) => ({
          name,
          ...value,
          costBrlCents: usdMicrosToBrlCents(value.costUsdMicros, rate),
        }))
        .sort((a, b) => b.costUsdMicros - a.costUsdMicros);
    };

    const emails = await this.users.emailsFor(
      topUsers.map((row) => row.userId),
    );

    return {
      totalUsdMicros: rows.reduce((total, row) => total + row.costUsdMicros, 0),
      byFeature: sum((row) => row.feature).map(({ name, ...value }) => ({
        feature: name,
        ...value,
      })),
      byTier: sum((row) => row.tier ?? 'SYSTEM').map(({ name, ...value }) => ({
        tier: name,
        ...value,
      })),
      topUsers: topUsers.map((row) => ({
        userId: row.userId,
        email: emails.get(row.userId) ?? null,
        calls: row._sum.aiCalls ?? 0,
        costUsdMicros: row._sum.aiCostUsdMicros ?? 0,
        costBrlCents: usdMicrosToBrlCents(row._sum.aiCostUsdMicros ?? 0, rate),
      })),
    };
  }

  /**
   * Receita × custo por plano. Receita do período = MRR de cada dia × 12 ÷
   * 365 (o "quanto aquele dia valeu" de uma assinatura). Não é caixa: é o
   * que está contratado — não existe tabela de pagamento recebido.
   */
  private revenueSection(
    rows: readonly {
      date: Date;
      tier: PlanTier;
      activeSubscribers: number;
      mrrCents: number;
      activeUsers: number;
      aiCostUsdMicros: number;
    }[],
    rate: number,
  ) {
    return {
      usdBrlRate: rate,
      byTier: PLAN_TIERS.map((tier) => {
        const days = rows.filter((row) => row.tier === tier);
        const revenueCents = Math.round(
          days.reduce((sum, row) => sum + (row.mrrCents * 12) / 365, 0),
        );
        const aiCostUsdMicros = days.reduce(
          (sum, row) => sum + row.aiCostUsdMicros,
          0,
        );
        const aiCostBrlCents = usdMicrosToBrlCents(aiCostUsdMicros, rate);
        const last = days.at(-1);

        return {
          tier,
          subscribers: last?.activeSubscribers ?? 0,
          mrrCents: last?.mrrCents ?? 0,
          activeUsers: last?.activeUsers ?? 0,
          revenueCents,
          aiCostUsdMicros,
          aiCostBrlCents,
          marginCents: revenueCents - aiCostBrlCents,
        };
      }),
    };
  }
}
