import { Injectable } from '@nestjs/common';
import {
  COMPETENCIES,
  COMPETENCY_LABELS,
  type CefrLevel,
  type Competency,
} from '@english-saas/shared';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { EntitlementsService } from 'src/modules/billing/services/entitlements.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';
import { LearningActivityService } from 'src/modules/learning/services/learning-activity.service';
import { LearningStatsService } from 'src/modules/learning/services/learning-stats.service';
import type { PlanForecast } from 'src/modules/planner/domain/build-path';
import { PlanService } from 'src/modules/planner/services/plan.service';
import { ReviewCardService } from 'src/modules/srs/services/review-card.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  accuracyLabel,
  lessonBySkill,
  suggestAction,
  type WeaknessAction,
} from '../domain/actions';
import { mergeTallies, toMinutes } from '../domain/activity';
import { addDays, localDateOf, recentWeeks, weekStart } from '../domain/dates';
import { paceForecast, type PaceForecast } from '../domain/forecast';
import {
  ERROR_TREND_LABELS,
  errorTrend,
  weeklyCompliance,
  weeklyLevelSeries,
  type ErrorTrend,
  type WeekCompliance,
  type WeeklyLevel,
} from '../domain/trends';
import {
  AggregationService,
  fromDbDate,
  toDbDate,
} from './aggregation.service';

/** Semanas completas usadas para medir o ritmo. */
const PACE_WEEKS = 4;
const TOP_ERRORS = 5;

export type StudentProgress = {
  period: { from: string; to: string; weeks: number };
  level: {
    overall: { level: CefrLevel; label: string; note: string };
    competencies: {
      competency: Competency;
      label: string;
      level: CefrLevel | null;
      confidence: string;
    }[];
    weekly: WeeklyLevel[];
  };
  strengths: { skillId: string; title: string; text: string }[];
  weaknesses: {
    skillId: string;
    title: string;
    text: string;
    action: WeaknessAction;
  }[];
  stats: {
    minutesStudied: number;
    lessonsCompleted: number;
    reviewsDone: number;
    currentStreak: number;
    longestStreak: number;
    accuracyByCompetency: {
      competency: Competency;
      label: string;
      answered: number;
      correct: number;
      rate: number | null;
      text: string;
    }[];
    topErrors: {
      errorPatternId: string;
      description: string;
      correction: string;
      recentOccurrences: number;
      opportunities: number;
      trend: ErrorTrend;
      trendLabel: string;
    }[];
  };
  plan: { weeks: WeekCompliance[] };
  forecast: PaceForecast & { targetLevel: CefrLevel | null };
};

/**
 * `GET /me/progress`. Lê as linhas diárias que o job gravou; só o dia de
 * hoje é calculado na hora (um aluno, um dia — a mesma conta do job), para
 * a lição que ele acabou de fazer já aparecer.
 */
@Injectable()
export class StudentProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: AggregationService,
    private readonly users: UsersService,
    private readonly profiles: LearnerProfileService,
    private readonly stats: LearningStatsService,
    private readonly learning: LearningActivityService,
    private readonly catalog: CatalogService,
    private readonly cards: ReviewCardService,
    private readonly entitlements: EntitlementsService,
    private readonly plans: PlanService,
  ) {}

  async get(
    userId: string,
    weeks: number,
    now = new Date(),
  ): Promise<StudentProgress> {
    const context = await this.users.studyContextOf(userId);
    const today = localDateOf(now, context.timezone);
    const weekList = recentWeeks(today, weeks);
    const from = weekList[0] ?? today;

    const [stored, [live], profile, history, errors, streak, plan] =
      await Promise.all([
        this.prisma.userDailyActivity.findMany({
          where: {
            userId,
            date: { gte: toDbDate(from), lt: toDbDate(today) },
          },
          orderBy: { date: 'asc' },
        }),
        this.aggregation.buildUserDays([context], today),
        this.profiles.getProfile(userId),
        this.profiles.levelHistory(userId, from),
        this.profiles.errorHistory(userId),
        this.stats.get(userId, now),
        this.plans.findPlan(userId),
      ]);

    const days = [
      ...stored.map((row) => ({
        date: fromDbDate(row.date),
        studySeconds: row.studySeconds,
        plannedMinutes: row.plannedMinutes,
        lessonsCompleted: row.lessonsCompleted,
        reviewsDone: row.reviewsDone,
        byCompetency: row.byCompetency as ReturnType<typeof mergeTallies>,
      })),
      ...(live === undefined
        ? []
        : [
            {
              date: today,
              studySeconds: live.studySeconds,
              plannedMinutes: live.plannedMinutes,
              lessonsCompleted: live.lessonsCompleted,
              reviewsDone: live.reviewsDone,
              byCompetency: live.byCompetency,
            },
          ]),
    ];

    const compliance = weeklyCompliance(days, weekList, weekStart);
    const tallies = mergeTallies(days.map((day) => day.byCompetency));
    const weaknesses = await this.weaknessActions(userId, profile.weaknesses);

    return {
      period: { from, to: today, weeks },
      level: {
        overall: profile.overallLevel,
        competencies: profile.competencies,
        weekly: weeklyLevelSeries(history, weekList),
      },
      strengths: profile.strengths.map((skill) => ({
        ...skill,
        text: `Você já domina: ${skill.title}.`,
      })),
      weaknesses,
      stats: {
        minutesStudied: toMinutes(
          days.reduce((sum, day) => sum + day.studySeconds, 0),
        ),
        lessonsCompleted: days.reduce(
          (sum, day) => sum + day.lessonsCompleted,
          0,
        ),
        reviewsDone: days.reduce((sum, day) => sum + day.reviewsDone, 0),
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        accuracyByCompetency: COMPETENCIES.map((competency) => {
          const tally = tallies[competency] ?? { answered: 0, correct: 0 };
          return {
            competency,
            label: COMPETENCY_LABELS[competency],
            answered: tally.answered,
            correct: tally.correct,
            rate:
              tally.answered === 0
                ? null
                : Math.round((tally.correct / tally.answered) * 100) / 100,
            text: accuracyLabel(tally.answered, tally.correct),
          };
        }),
        topErrors: errors
          .map((error) => {
            const trend = errorTrend(error.recentOutcomes);
            return {
              errorPatternId: error.errorPatternId,
              description: error.description,
              correction: error.correction,
              recentOccurrences: error.recentOutcomes.filter(Boolean).length,
              opportunities: error.recentOutcomes.length,
              trend,
              trendLabel: ERROR_TREND_LABELS[trend],
            };
          })
          .filter((error) => error.recentOccurrences > 0)
          .sort(
            (a, b) =>
              b.recentOccurrences - a.recentOccurrences ||
              a.errorPatternId.localeCompare(b.errorPatternId),
          )
          .slice(0, TOP_ERRORS),
      },
      plan: { weeks: compliance },
      forecast: {
        ...this.forecast({
          today,
          signupWeek: weekStart(
            localDateOf(context.createdAt, context.timezone),
          ),
          compliance,
          plannedWeeklyMinutes: Object.values(
            context.availabilityMinutes,
          ).reduce((sum, minutes) => sum + minutes, 0),
          planArrival:
            (plan?.forecast as unknown as PlanForecast | null)
              ?.estimatedArrival ?? null,
        }),
        targetLevel: plan?.targetLevel ?? null,
      },
    };
  }

  /**
   * Os números de uma semana (segunda a domingo, dias locais do aluno), das
   * linhas que o job gravou. É o que o resumo semanal (15) manda.
   */
  async weekSummary(
    userId: string,
    weekStartDate: string,
  ): Promise<{
    studyMinutes: number;
    plannedMinutes: number;
    lessonsCompleted: number;
    reviewsDone: number;
    firstTryAnswers: number;
    firstTryCorrect: number;
    activeDays: number;
  }> {
    const rows = await this.prisma.userDailyActivity.findMany({
      where: {
        userId,
        date: {
          gte: toDbDate(weekStartDate),
          lte: toDbDate(addDays(weekStartDate, 6)),
        },
      },
    });
    const total = (pick: (row: (typeof rows)[number]) => number) =>
      rows.reduce((sum, row) => sum + pick(row), 0);

    return {
      studyMinutes: toMinutes(total((row) => row.studySeconds)),
      plannedMinutes: total((row) => row.plannedMinutes),
      lessonsCompleted: total((row) => row.lessonsCompleted),
      reviewsDone: total((row) => row.reviewsDone),
      firstTryAnswers: total((row) => row.firstTryAnswers),
      firstTryCorrect: total((row) => row.firstTryCorrect),
      activeDays: rows.filter((row) => row.active).length,
    };
  }

  /**
   * Ritmo pelas últimas semanas **completas** (a atual ainda está no meio)
   * desde o cadastro — semana antes de a conta existir não é semana parada.
   */
  private forecast(input: {
    today: string;
    signupWeek: string;
    compliance: readonly WeekCompliance[];
    plannedWeeklyMinutes: number;
    planArrival: string | null;
  }): PaceForecast {
    const currentWeek = weekStart(input.today);
    const recent = input.compliance
      .filter(
        (week) =>
          week.weekStart < currentWeek && week.weekStart >= input.signupWeek,
      )
      .slice(-PACE_WEEKS)
      .map((week) => week.studiedMinutes);

    return paceForecast({
      today: input.today,
      planArrival: input.planArrival,
      plannedWeeklyMinutes: input.plannedWeeklyMinutes,
      recentWeeklyMinutes: recent,
    });
  }

  private async weaknessActions(
    userId: string,
    weaknesses: readonly { skillId: string; title: string; why: string }[],
  ): Promise<StudentProgress['weaknesses']> {
    if (weaknesses.length === 0) {
      return [];
    }

    const skillIds = weaknesses.map((weakness) => weakness.skillId);
    const [coursePath, cardIds, canGenerate] = await Promise.all([
      this.catalog.publishedCoursePath(),
      this.cards.cardIdsForSkills(userId, skillIds),
      this.entitlements.can(userId, 'GENERATOR_TOPIC'),
    ]);
    const lessons = lessonBySkill(coursePath);
    const completed = await this.learning.completedLessonIds(
      userId,
      skillIds.flatMap((skillId) => {
        const lesson = lessons.get(skillId);
        return lesson === undefined ? [] : [lesson.lessonId];
      }),
    );

    return weaknesses.map((weakness) => {
      const lesson = lessons.get(weakness.skillId);

      return {
        skillId: weakness.skillId,
        title: weakness.title,
        text: `Vale reforçar: ${weakness.title}. ${weakness.why}`,
        action: suggestAction(weakness, {
          lesson:
            lesson === undefined
              ? null
              : { ...lesson, completed: completed.has(lesson.lessonId) },
          reviewCardId: cardIds.get(weakness.skillId) ?? null,
          canGenerate,
        }),
      };
    });
  }
}
