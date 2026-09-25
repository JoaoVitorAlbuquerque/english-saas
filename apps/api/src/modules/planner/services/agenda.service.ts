import { Injectable } from '@nestjs/common';
import type { DailyAgenda, Prisma } from '@prisma/client';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AdaptiveItemService } from 'src/modules/assessment/services/adaptive-item.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { localDate } from 'src/modules/learning/domain/streak';
import { MASTERY_THRESHOLD } from 'src/modules/planner/domain/build-path';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';
import {
  buildSession,
  DEFAULT_SECONDS_PER_CARD,
  isRecurring,
} from 'src/modules/srs/domain/session';
import { ReviewCardService } from 'src/modules/srs/services/review-card.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  buildAgenda,
  DEFAULT_PRACTICE_ITEM_MINUTES,
  REVIEW_SHARE,
  type AgendaBlock,
  type NextLessonCandidate,
  type PracticeCandidate,
  type ReviewCandidate,
} from '../domain/build-agenda';
import type { PathEntry } from '../domain/build-path';

/** Poucos itens de prática por dia — o resto do tempo é lição e revisão. */
const MAX_PRACTICE_ITEMS = 8;
const WEEKDAY_INDEX = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
] as const;

export type AgendaBlockView = AgendaBlock & { skipped: boolean };

export type DailyAgendaView = {
  localDate: string;
  generatedAt: Date;
  blocks: AgendaBlockView[];
};

/**
 * Monta e serve a agenda do dia. Gerada uma vez por dia local do aluno e
 * guardada — não porque o cálculo seja caro, mas pra `skip` persistir dentro
 * do mesmo dia sem recalcular tudo de novo a cada leitura.
 */
@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly reviewCards: ReviewCardService,
    private readonly adaptiveItems: AdaptiveItemService,
    private readonly taxonomy: TaxonomyService,
    private readonly profiles: LearnerProfileService,
  ) {}

  async today(userId: string, now = new Date()): Promise<DailyAgendaView> {
    const timezone = await this.users.timezoneOf(userId);
    const localDateStr = localDate(now, timezone);

    const existing = await this.prisma.dailyAgenda.findUnique({
      where: { userId_localDate: { userId, localDate: localDateStr } },
    });

    const row = existing ?? (await this.generate(userId, localDateStr, now));

    return this.toView(row);
  }

  async skip(
    userId: string,
    blockId: string,
    now = new Date(),
  ): Promise<DailyAgendaView> {
    const timezone = await this.users.timezoneOf(userId);
    const localDateStr = localDate(now, timezone);

    const existing = await this.prisma.dailyAgenda.findUnique({
      where: { userId_localDate: { userId, localDate: localDateStr } },
    });

    if (existing === null) {
      throw new NotFoundError('Você ainda não tem uma agenda hoje.');
    }

    const blocks = existing.blocks as unknown as AgendaBlockView[];

    if (!blocks.some((block) => block.id === blockId)) {
      throw new NotFoundError('Não achamos esse bloco na agenda de hoje.');
    }

    const updated = await this.prisma.dailyAgenda.update({
      where: { id: existing.id },
      data: {
        blocks: blocks.map((block) =>
          block.id === blockId ? { ...block, skipped: true } : block,
        ) as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toView(updated);
  }

  /** Invalida a agenda de hoje — chamado quando o path ou o plano mudam. */
  async invalidateToday(userId: string, now = new Date()): Promise<void> {
    const timezone = await this.users.timezoneOf(userId);
    const localDateStr = localDate(now, timezone);

    await this.prisma.dailyAgenda.deleteMany({
      where: { userId, localDate: localDateStr },
    });
  }

  private async generate(
    userId: string,
    localDateStr: string,
    now: Date,
  ): Promise<DailyAgenda> {
    const [profile, plan] = await Promise.all([
      this.users.getProfile(userId),
      this.prisma.studyPlan.findUnique({ where: { userId } }),
    ]);

    const weekday =
      WEEKDAY_INDEX[new Date(`${localDateStr}T00:00:00.000Z`).getUTCDay()];
    const budgetMinutes =
      weekday === undefined ? 0 : profile.availabilityMinutes[weekday];

    const review = await this.reviewCandidate(userId, budgetMinutes, now);

    const pathEntries =
      (plan?.path as unknown as PathEntry[] | undefined) ?? [];
    const nextEntry = pathEntries[0];
    const nextLesson: NextLessonCandidate | null =
      nextEntry === undefined
        ? null
        : {
            lessonId: nextEntry.lessonId,
            title: nextEntry.title,
            estimatedMinutes: nextEntry.estimatedMinutes,
            reason: nextEntry.reason,
          };

    const practice = await this.practiceCandidates(
      userId,
      plan?.reinforceSkillIds ?? [],
      now,
    );

    const blocks = buildAgenda({ budgetMinutes, review, nextLesson, practice });

    const data = {
      blocks: blocks.map((block) => ({
        ...block,
        skipped: false,
      })) as unknown as Prisma.InputJsonValue,
      generatedAt: now,
    };

    return this.prisma.dailyAgenda.upsert({
      where: { userId_localDate: { userId, localDate: localDateStr } },
      create: { userId, localDate: localDateStr, ...data },
      update: data,
    });
  }

  private async reviewCandidate(
    userId: string,
    budgetMinutes: number,
    now: Date,
  ): Promise<ReviewCandidate | null> {
    const due = await this.reviewCards.dueFor(userId, now);

    if (due.length === 0) {
      return null;
    }

    const reviewBudget = Math.floor(budgetMinutes * REVIEW_SHARE);
    const picked = buildSession(
      due.map((card) => ({
        id: card.id,
        kind: card.kind,
        due: card.due,
        lapses: card.lapses,
      })),
      now,
      reviewBudget,
    );

    if (picked.length === 0) {
      return null;
    }

    return {
      count: picked.length,
      estimatedMinutes: Math.ceil(
        (picked.length * DEFAULT_SECONDS_PER_CARD) / 60,
      ),
      hasRecurringError: picked.some((card) => isRecurring(card)),
    };
  }

  private async practiceCandidates(
    userId: string,
    reinforceSkillIds: readonly string[],
    now: Date,
  ): Promise<PracticeCandidate[]> {
    if (reinforceSkillIds.length === 0) {
      return [];
    }

    const mastery = await this.profiles.masteryBySkill(
      userId,
      reinforceSkillIds,
      now,
    );
    const stillWeak = reinforceSkillIds.filter(
      (skillId) => (mastery.get(skillId)?.mastery ?? 0) < MASTERY_THRESHOLD,
    );

    if (stillWeak.length === 0) {
      return [];
    }

    const [selected, skills, graph, snapshot] = await Promise.all([
      this.adaptiveItems.selectItems({
        userId,
        skills: stillWeak,
        count: Math.min(stillWeak.length, MAX_PRACTICE_ITEMS),
        targetP: 0.7,
        now,
      }),
      this.taxonomy.skillsByIds(stillWeak),
      this.taxonomy.skillGraph(),
      this.profiles.getSnapshot(userId),
    ]);

    const titleById = new Map(skills.map((skill) => [skill.id, skill.title]));
    const errorPatternIdsBySkill = new Map(
      graph.map((node) => [node.id, node.errorPatternIds]),
    );
    const occurrencesByPattern = new Map(
      snapshot.weaknesses.errorPatterns.map((pattern) => [
        pattern.id,
        pattern.recentOccurrences,
      ]),
    );

    return selected.map((entry) => {
      const occurrences = (errorPatternIdsBySkill.get(entry.skillId) ?? [])
        .map((id) => occurrencesByPattern.get(id))
        .find((value) => value !== undefined);

      return {
        itemId: entry.itemId,
        skillId: entry.skillId,
        skillTitle: titleById.get(entry.skillId) ?? entry.skillId,
        estimatedMinutes: DEFAULT_PRACTICE_ITEM_MINUTES,
        recentOccurrences: occurrences ?? null,
      };
    });
  }

  private toView(row: DailyAgenda): DailyAgendaView {
    return {
      localDate: row.localDate,
      generatedAt: row.generatedAt,
      blocks: row.blocks as unknown as AgendaBlockView[],
    };
  }
}
