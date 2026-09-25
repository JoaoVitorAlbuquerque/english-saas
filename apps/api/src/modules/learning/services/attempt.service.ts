import { Injectable, Logger } from '@nestjs/common';
import {
  LessonAttemptStatus,
  Prisma,
  type LessonAttempt,
  type LessonAttemptSource,
  type LessonStepType,
} from '@prisma/client';
import type { Paginated } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import {
  CatalogService,
  type PublishedOutline,
} from 'src/modules/curriculum/services/catalog.service';
import { CatalogAccessService } from 'src/modules/curriculum/services/catalog-access.service';

import {
  decideStart,
  missingSteps,
  nextStepIndex,
  unansweredItems,
} from '../domain/attempt-progress';
import { lessonXp, type LessonXp } from '../domain/xp';
import {
  AttemptClosedError,
  AttemptIncompleteError,
  PracticeIncompleteError,
} from '../learning.errors';
import {
  LearningStatsService,
  type LearningStatsView,
} from './learning-stats.service';

export type AttemptView = {
  id: string;
  lessonId: string;
  lessonVersionId: string;
  version: number;
  status: LessonAttemptStatus;
  source: LessonAttemptSource;
  currentStepIndex: number;
  totalSteps: number;
  steps: {
    index: number;
    type: string;
    completed: boolean;
    itemIds: string[];
  }[];
  /** Questões já respondidas nesta tentativa — o player retoma daqui. */
  answeredItemIds: string[];
  xpEarned: number;
  startedAt: Date;
  completedAt: Date | null;
};

export type CompletionResult = {
  attempt: AttemptView;
  xp: LessonXp;
  stats: LearningStatsView;
};

/**
 * Tentativa de lição: iniciar ou retomar, concluir etapa, concluir lição.
 *
 * A estrutura da lição vem do `CatalogService` (módulo 4), sempre da versão
 * **da tentativa** — se a lição for republicada no meio do caminho, quem já
 * está dentro continua corrigido contra o que viu.
 */
@Injectable()
export class AttemptService {
  private readonly logger = new Logger(AttemptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly access: CatalogAccessService,
    private readonly stats: LearningStatsService,
    private readonly events: EventBusService,
  ) {}

  /**
   * Inicia ou retoma. `resumed` diz qual dos dois aconteceu. Lição fora do
   * plano do aluno é 403 `PLAN_REQUIRED` — inclusive retomar, porque o
   * plano pode ter vencido depois que a tentativa abriu.
   */
  async start(
    userId: string,
    lessonId: string,
    source: LessonAttemptSource,
  ): Promise<{ attempt: AttemptView; resumed: boolean }> {
    const outline = await this.catalog.findPublishedOutline(lessonId);
    await this.access.assertLesson(userId, lessonId);
    const open = await this.findOpen(userId, lessonId);
    const decision = decideStart(open, outline.versionId);

    if (decision.action === 'RESUME' && open !== null) {
      return { attempt: await this.view(open, outline), resumed: true };
    }

    if (decision.action === 'RESTART') {
      await this.prisma.lessonAttempt.update({
        where: { id: decision.abandonAttemptId },
        data: {
          status: LessonAttemptStatus.ABANDONED,
          abandonedAt: new Date(),
        },
      });
    }

    let created: LessonAttempt;

    try {
      created = await this.prisma.lessonAttempt.create({
        data: {
          userId,
          lessonId,
          lessonVersionId: outline.versionId,
          versionNumber: outline.version,
          source,
        },
      });
    } catch (error) {
      // Dois "começar" ao mesmo tempo: o índice parcial deixa só um passar.
      // O perdedor retoma o que o outro criou.
      if (isUniqueViolation(error)) {
        const winner = await this.findOpen(userId, lessonId);

        if (winner !== null) {
          return { attempt: await this.view(winner, outline), resumed: true };
        }
      }

      throw error;
    }

    this.events.emit(
      'lesson.started',
      {
        attemptId: created.id,
        lessonId,
        lessonVersionId: outline.versionId,
        version: outline.version,
        source,
      },
      { userId },
    );

    return { attempt: await this.view(created, outline), resumed: false };
  }

  async completeStep(
    userId: string,
    attemptId: string,
    stepIndex: number,
    input: { timeSpentMs: number; response?: { text: string } | undefined },
  ): Promise<AttemptView> {
    const attempt = await this.findOwned(userId, attemptId);
    assertOpen(attempt);

    const outline = await this.catalog.findVersionOutline(
      attempt.lessonVersionId,
    );
    const step = outline.steps[stepIndex];

    if (step === undefined) {
      throw new NotFoundError('Esta lição não tem essa etapa.');
    }

    if (step.type === 'PRACTICE') {
      const missing = unansweredItems(
        step.itemIds,
        await this.answeredItemIds(attempt.id),
      );

      if (missing.length > 0) {
        throw new PracticeIncompleteError(missing);
      }
    }

    const existing = await this.prisma.stepProgress.findUnique({
      where: { attemptId_stepIndex: { attemptId, stepIndex } },
      select: { id: true },
    });

    // Concluir de novo é inofensivo: devolve o estado, sem evento nem escrita.
    if (existing !== null) {
      return this.view(attempt, outline);
    }

    const keepsResponse =
      step.type === 'FREE_PRODUCTION' && input.response !== undefined;

    try {
      await this.prisma.stepProgress.create({
        data: {
          attemptId,
          stepIndex,
          type: step.type as LessonStepType,
          timeSpentMs: input.timeSpentMs,
          ...(keepsResponse ? { response: input.response } : {}),
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Corrida com outra requisição igual: ela já gravou e emitiu.
      return this.view(await this.findOwned(userId, attemptId), outline);
    }

    const completed = await this.completedIndices(attemptId);
    const updated = await this.prisma.lessonAttempt.update({
      where: { id: attemptId },
      data: {
        currentStepIndex: nextStepIndex(outline.steps.length, completed),
      },
    });

    this.events.emit(
      'lesson.step_completed',
      {
        attemptId,
        lessonId: attempt.lessonId,
        stepIndex,
        stepType: step.type,
        timeSpentMs: input.timeSpentMs,
      },
      { userId },
    );

    await this.stats.recordActivity(userId);

    return this.view(updated, outline);
  }

  /**
   * Conclui a lição. Idempotente: concluir de novo devolve o mesmo resumo,
   * sem somar XP outra vez.
   */
  async complete(userId: string, attemptId: string): Promise<CompletionResult> {
    const attempt = await this.findOwned(userId, attemptId);
    const outline = await this.catalog.findVersionOutline(
      attempt.lessonVersionId,
    );

    const answers = await this.prisma.answer.findMany({
      where: { attemptId },
      select: { score: true, isFirstTry: true, isCorrect: true },
    });

    if (attempt.status === LessonAttemptStatus.COMPLETED) {
      // O que foi gravado na conclusão, não um recálculo: uma conclusão
      // posterior da mesma lição mudaria o bônus retroativamente.
      const fromAnswers = lessonXp({
        answers,
        completedBefore: false,
      }).fromAnswers;

      return {
        attempt: await this.view(attempt, outline),
        xp: {
          fromAnswers,
          completionBonus: attempt.xpEarned - fromAnswers,
          total: attempt.xpEarned,
        },
        stats: await this.stats.recordActivity(userId),
      };
    }

    assertOpen(attempt);

    const completedBefore = await this.hasCompletedBefore(attempt);
    const xp = lessonXp({ answers, completedBefore });

    const missing = missingSteps(
      outline.steps.length,
      await this.completedIndices(attemptId),
    );

    if (missing.length > 0) {
      throw new AttemptIncompleteError(missing);
    }

    const now = new Date();

    // `updateMany` com o status no filtro: se duas conclusões correrem juntas,
    // só uma muda a linha — e só ela soma XP.
    const { count } = await this.prisma.lessonAttempt.updateMany({
      where: { id: attemptId, status: LessonAttemptStatus.IN_PROGRESS },
      data: {
        status: LessonAttemptStatus.COMPLETED,
        completedAt: now,
        xpEarned: xp.total,
        currentStepIndex: outline.steps.length,
      },
    });

    const stats =
      count === 1
        ? await this.stats.award(userId, xp.total, now)
        : await this.stats.recordActivity(userId, now);
    const completed = await this.findOwned(userId, attemptId);

    if (count === 1) {
      const firstTries = answers.filter((answer) => answer.isFirstTry);

      this.events.emit(
        'lesson.completed',
        {
          attemptId,
          lessonId: attempt.lessonId,
          lessonVersionId: attempt.lessonVersionId,
          source: attempt.source,
          xpEarned: xp.total,
          durationMs: now.getTime() - attempt.startedAt.getTime(),
          answeredItems: firstTries.length,
          correctFirstTries: firstTries.filter((answer) => answer.isCorrect)
            .length,
          currentStreak: stats.currentStreak,
        },
        { userId },
      );

      this.logger.log(
        { attemptId, xp: xp.total, completedBefore },
        'Lição concluída',
      );
    }

    return { attempt: await this.view(completed, outline), xp, stats };
  }

  /** Histórico do aluno, mais recente primeiro. */
  async history(
    userId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.lessonAttempt.findMany({
      take,
      ...cursorArgs,
      where: { userId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });

    const page = buildPage(rows, query.limit, (row) => row.id);
    const summaries = new Map(
      (
        await this.catalog.versionSummaries([
          ...new Set(page.data.map((row) => row.lessonVersionId)),
        ])
      ).map((summary) => [summary.versionId, summary]),
    );

    return {
      ...page,
      data: page.data.map((row) => {
        const summary = summaries.get(row.lessonVersionId);

        return {
          attemptId: row.id,
          lessonId: row.lessonId,
          lessonSlug: summary?.lessonSlug ?? null,
          title: summary?.title ?? null,
          cefrLevel: summary?.cefrLevel ?? null,
          version: row.versionNumber,
          status: row.status,
          source: row.source,
          currentStepIndex: row.currentStepIndex,
          xpEarned: row.xpEarned,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        };
      }),
    };
  }

  /**
   * Títulos das últimas lições concluídas, sem repetição, mais recente
   * primeiro. O modelo do aluno (7) usa como "temas recentes", para o que
   * for gerado não repetir o assunto.
   */
  async recentLessonTitles(userId: string, limit = 5): Promise<string[]> {
    const rows = await this.prisma.lessonAttempt.findMany({
      where: { userId, status: LessonAttemptStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      take: limit * 3,
      select: { lessonVersionId: true },
    });

    const versionIds = [...new Set(rows.map((row) => row.lessonVersionId))];
    const titles = new Map(
      (await this.catalog.versionSummaries(versionIds)).map((summary) => [
        summary.versionId,
        summary.title,
      ]),
    );

    return [
      ...new Set(
        versionIds.flatMap((id) => {
          const title = titles.get(id);
          return title === undefined ? [] : [title];
        }),
      ),
    ].slice(0, limit);
  }

  // -------------------------------------------------------------------
  // Usado pelo AnswerService
  // -------------------------------------------------------------------

  /**
   * Tentativa aberta do aluno. De outro aluno responde 404, não 403 — não
   * confirmamos que o id existe.
   */
  async findOpenOwned(userId: string, attemptId: string) {
    const attempt = await this.findOwned(userId, attemptId);
    assertOpen(attempt);
    return attempt;
  }

  // -------------------------------------------------------------------

  private async findOwned(
    userId: string,
    attemptId: string,
  ): Promise<LessonAttempt> {
    const attempt = await this.prisma.lessonAttempt.findUnique({
      where: { id: attemptId },
    });

    if (attempt?.userId !== userId) {
      throw new NotFoundError('Não encontramos esta tentativa.');
    }

    return attempt;
  }

  private async findOpen(userId: string, lessonId: string) {
    return this.prisma.lessonAttempt.findFirst({
      where: { userId, lessonId, status: LessonAttemptStatus.IN_PROGRESS },
    });
  }

  private async hasCompletedBefore(attempt: LessonAttempt): Promise<boolean> {
    const previous = await this.prisma.lessonAttempt.count({
      where: {
        userId: attempt.userId,
        lessonId: attempt.lessonId,
        status: LessonAttemptStatus.COMPLETED,
        id: { not: attempt.id },
      },
    });

    return previous > 0;
  }

  private async completedIndices(attemptId: string): Promise<number[]> {
    const rows = await this.prisma.stepProgress.findMany({
      where: { attemptId },
      select: { stepIndex: true },
    });

    return rows.map((row) => row.stepIndex);
  }

  private async answeredItemIds(attemptId: string): Promise<string[]> {
    const rows = await this.prisma.answer.findMany({
      where: { attemptId },
      distinct: ['itemId'],
      select: { itemId: true },
    });

    return rows.map((row) => row.itemId);
  }

  private async view(
    attempt: LessonAttempt,
    outline: PublishedOutline,
  ): Promise<AttemptView> {
    const completed = new Set(await this.completedIndices(attempt.id));

    return {
      id: attempt.id,
      lessonId: attempt.lessonId,
      lessonVersionId: attempt.lessonVersionId,
      version: attempt.versionNumber,
      status: attempt.status,
      source: attempt.source,
      currentStepIndex: attempt.currentStepIndex,
      totalSteps: outline.steps.length,
      steps: outline.steps.map((step) => ({
        index: step.index,
        type: step.type,
        completed: completed.has(step.index),
        itemIds: step.itemIds,
      })),
      answeredItemIds: await this.answeredItemIds(attempt.id),
      xpEarned: attempt.xpEarned,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    };
  }
}

function assertOpen(attempt: LessonAttempt): void {
  if (attempt.status !== LessonAttemptStatus.IN_PROGRESS) {
    throw new AttemptClosedError(attempt.status);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
