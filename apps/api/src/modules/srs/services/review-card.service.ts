import { Injectable } from '@nestjs/common';
import type {
  ReviewCard,
  ReviewCardKind as PrismaReviewCardKind,
  ReviewCardSource,
} from '@prisma/client';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import type { CardCandidate, ReviewCardKind } from '../domain/card-creation';
import { cardKey } from '../domain/card-creation';
import {
  emptyCardState,
  scheduleReview,
  type FsrsRating,
  type ReviewCardFsrsState,
} from '../domain/fsrs';

/** Lê e escreve `ReviewCard`. O FSRS mora em `domain/fsrs.ts` — aqui só I/O. */
@Injectable()
export class ReviewCardService {
  constructor(private readonly prisma: PrismaService) {}

  async dueFor(userId: string, now: Date): Promise<ReviewCard[]> {
    return this.prisma.reviewCard.findMany({
      where: { userId, suspended: false, due: { lte: now } },
    });
  }

  async findOwned(userId: string, cardId: string): Promise<ReviewCard> {
    const card = await this.prisma.reviewCard.findUnique({
      where: { id: cardId },
    });

    if (card?.userId !== userId) {
      throw new NotFoundError('Não encontramos este card de revisão.');
    }

    return card;
  }

  async existingKeys(
    userId: string,
    candidates: readonly CardCandidate[],
  ): Promise<Set<string>> {
    if (candidates.length === 0) {
      return new Set();
    }

    const rows = await this.prisma.reviewCard.findMany({
      where: {
        userId,
        OR: candidates.map((candidate) => ({
          kind: candidate.kind as PrismaReviewCardKind,
          refId: candidate.refId,
        })),
      },
      select: { kind: true, refId: true },
    });

    return new Set(rows.map((row) => cardKey(row)));
  }

  /** Cria os cards que faltam. Idempotente: o que já existe, ignora. */
  async createMany(
    userId: string,
    source: ReviewCardSource,
    candidates: readonly CardCandidate[],
    now: Date,
  ): Promise<void> {
    if (candidates.length === 0) {
      return;
    }

    const initial = emptyCardState(now);

    await this.prisma.reviewCard.createMany({
      data: candidates.map((candidate) => ({
        userId,
        kind: candidate.kind as PrismaReviewCardKind,
        refId: candidate.refId,
        source,
        ...toRow(initial),
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Erro de primeira tentativa numa lição: cria o card se não existe, ou
   * registra um lapse (Again) se já existia — é o que "com prioridade" do
   * pedido significa na prática: o card sobe na ordenação da sessão porque
   * lapsou, não por um campo próprio (ver `domain/session.ts`).
   */
  async ensureOrLapse(
    userId: string,
    kind: ReviewCardKind,
    refId: string,
    source: ReviewCardSource,
    now: Date,
  ): Promise<void> {
    const existing = await this.prisma.reviewCard.findUnique({
      where: {
        userId_kind_refId: {
          userId,
          kind: kind as PrismaReviewCardKind,
          refId,
        },
      },
    });

    if (existing === null) {
      await this.prisma.reviewCard.create({
        data: {
          userId,
          kind: kind as PrismaReviewCardKind,
          refId,
          source,
          ...toRow(emptyCardState(now)),
        },
      });
      return;
    }

    const next = scheduleReview(fromRow(existing), 'AGAIN', now);
    await this.prisma.reviewCard.update({
      where: { id: existing.id },
      data: toRow(next),
    });
  }

  /**
   * Reagenda o card e grava a revisão no `ReviewLog`, na mesma transação:
   * o log é o histórico que o progresso (14) conta, e não pode divergir do
   * que o card diz.
   */
  async applyRating(
    card: ReviewCard,
    rating: FsrsRating,
    now: Date,
  ): Promise<ReviewCard> {
    const next = scheduleReview(fromRow(card), rating, now);
    const [updated] = await this.prisma.$transaction([
      this.prisma.reviewCard.update({
        where: { id: card.id },
        data: toRow(next),
      }),
      this.prisma.reviewLog.create({
        data: {
          userId: card.userId,
          cardId: card.id,
          kind: card.kind,
          rating,
          reviewedAt: now,
        },
      }),
    ]);

    return updated;
  }

  /** Ids dos cards do aluno por skill — a ação "revisar" do progresso. */
  async cardIdsForSkills(
    userId: string,
    skillIds: readonly string[],
  ): Promise<Map<string, string>> {
    if (skillIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.reviewCard.findMany({
      where: {
        userId,
        kind: 'SKILL',
        refId: { in: [...skillIds] },
        suspended: false,
      },
      select: { id: true, refId: true },
    });

    return new Map(rows.map((row) => [row.refId, row.id]));
  }
}

function toRow(state: ReviewCardFsrsState) {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    scheduledDays: state.scheduledDays,
    learningSteps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    lastReviewedAt: state.lastReviewedAt,
  };
}

function fromRow(card: ReviewCard): ReviewCardFsrsState {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReviewedAt: card.lastReviewedAt,
  };
}
