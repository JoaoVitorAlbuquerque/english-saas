import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/infra/prisma/prisma.service';

export type ReviewCounts = {
  userId: string;
  reviews: number;
  /** Revisões sem questão por trás: flashcard auto-avaliado (não SKILL). */
  flashcards: number;
};

/** Leitura do histórico de revisões (`ReviewLog`) para o progresso (14). */
@Injectable()
export class ReviewLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Revisões de cada aluno em `[from, to)`. Aluno sem revisão fica de fora. */
  async countsByUser(
    userIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<ReviewCounts[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.reviewLog.groupBy({
      by: ['userId', 'kind'],
      where: {
        userId: { in: [...userIds] },
        reviewedAt: { gte: from, lt: to },
      },
      _count: { _all: true },
    });

    const byUser = new Map<string, ReviewCounts>();

    for (const row of rows) {
      const current = byUser.get(row.userId) ?? {
        userId: row.userId,
        reviews: 0,
        flashcards: 0,
      };
      current.reviews += row._count._all;
      if (row.kind !== 'SKILL') {
        current.flashcards += row._count._all;
      }
      byUser.set(row.userId, current);
    }

    return [...byUser.values()];
  }
}
