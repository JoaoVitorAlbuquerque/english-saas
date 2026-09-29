import { Injectable } from '@nestjs/common';
import type { DailyAgenda, Prisma } from '@prisma/client';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AdaptiveItemService } from 'src/modules/assessment/services/adaptive-item.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
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
  type AgendaBlockStatus,
  type AgendaSkipReason,
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

export type AgendaBlockView = AgendaBlock & {
  status: AgendaBlockStatus;
  skipReason?: AgendaSkipReason;
  skipNote?: string;
  /** ISO. Só em `status: 'COMPLETED'`. */
  completedAt?: string;
  minutesSpent?: number;
};

export type DailyAgendaView = {
  localDate: string;
  generatedAt: Date;
  blocks: AgendaBlockView[];
  /** Soma de `minutesSpent` dos blocos concluídos — "minutos feitos hoje". */
  minutesCompleted: number;
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
    private readonly catalog: CatalogService,
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

  /** Pular um bloco não desfaz um já concluído — repetir é inofensivo. */
  async skip(
    userId: string,
    blockId: string,
    input: { reason?: AgendaSkipReason; note?: string },
    now = new Date(),
  ): Promise<DailyAgendaView> {
    return this.updateBlock(userId, blockId, now, (block) =>
      block.status === 'COMPLETED'
        ? block
        : {
            ...block,
            status: 'SKIPPED',
            skipReason: input.reason,
            skipNote: input.note,
          },
    );
  }

  /**
   * Concluir sempre pode sobrescrever um bloco pulado — o aluno pulou e
   * decidiu fazer depois, no mesmo dia. Repetir é inofensivo: fica com o
   * `completedAt`/`minutesSpent` da primeira vez.
   */
  async complete(
    userId: string,
    blockId: string,
    input: { minutesSpent?: number },
    now = new Date(),
  ): Promise<DailyAgendaView> {
    return this.updateBlock(userId, blockId, now, (block) =>
      block.status === 'COMPLETED'
        ? block
        : {
            ...block,
            status: 'COMPLETED',
            completedAt: now.toISOString(),
            minutesSpent: input.minutesSpent ?? block.estimatedMinutes,
          },
    );
  }

  /**
   * `lesson.completed` (6) chama isto em vez de invalidar a agenda inteira —
   * assim o resto do dia (revisão feita, prática pulada) não some junto.
   * Sem agenda hoje, ou sem bloco dessa lição (ela não veio do plano), não
   * faz nada.
   */
  async completeLessonBlock(
    userId: string,
    lessonId: string,
    now = new Date(),
  ): Promise<void> {
    const timezone = await this.users.timezoneOf(userId);
    const localDateStr = localDate(now, timezone);

    const existing = await this.prisma.dailyAgenda.findUnique({
      where: { userId_localDate: { userId, localDate: localDateStr } },
    });

    if (existing === null) {
      return;
    }

    const blocks = existing.blocks as unknown as AgendaBlockView[];
    const block = blocks.find(
      (candidate) =>
        candidate.type === 'LESSON' && candidate.refId === lessonId,
    );

    if (block === undefined || block.status === 'COMPLETED') {
      return;
    }

    await this.prisma.dailyAgenda.update({
      where: { id: existing.id },
      data: {
        blocks: blocks.map((candidate) =>
          candidate.id === block.id
            ? {
                ...candidate,
                status: 'COMPLETED',
                completedAt: now.toISOString(),
                minutesSpent: candidate.estimatedMinutes,
              }
            : candidate,
        ) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async updateBlock(
    userId: string,
    blockId: string,
    now: Date,
    apply: (block: AgendaBlockView) => AgendaBlockView,
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
          block.id === blockId ? apply(block) : block,
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
            slug: nextEntry.slug,
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
      blocks: blocks.map((block): AgendaBlockView => ({
        ...block,
        status: 'PENDING',
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

    // O item completo (sem gabarito) vai junto — o bloco de prática é
    // autossuficiente, do mesmo jeito que o card de SKILL da revisão (9).
    const items = await this.catalog.studentItems(
      selected.map((entry) => entry.itemId),
    );
    const itemById = new Map(items.map((item) => [item.id, item]));

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

    return selected.flatMap((entry) => {
      const item = itemById.get(entry.itemId);

      if (item === undefined) {
        return [];
      }

      const occurrences = (errorPatternIdsBySkill.get(entry.skillId) ?? [])
        .map((id) => occurrencesByPattern.get(id))
        .find((value) => value !== undefined);

      return [
        {
          itemId: entry.itemId,
          skillId: entry.skillId,
          skillTitle: titleById.get(entry.skillId) ?? entry.skillId,
          estimatedMinutes: DEFAULT_PRACTICE_ITEM_MINUTES,
          recentOccurrences: occurrences ?? null,
          item,
        },
      ];
    });
  }

  private toView(row: DailyAgenda): DailyAgendaView {
    const blocks = row.blocks as unknown as AgendaBlockView[];

    return {
      localDate: row.localDate,
      generatedAt: row.generatedAt,
      blocks,
      minutesCompleted: blocks
        .filter((block) => block.status === 'COMPLETED')
        .reduce((sum, block) => sum + (block.minutesSpent ?? 0), 0),
    };
  }
}
