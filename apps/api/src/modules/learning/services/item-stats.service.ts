import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';

import { computeItemStats, type ItemStats } from '../domain/item-stats';

export const ITEM_STATS_JOB = 'item-stats';

/**
 * Recalcula `exposureCount` e `correctRate` de um item.
 *
 * **Recalcula a partir das respostas**, em vez de somar incrementos: um job
 * que roda duas vezes, ou que falha no meio e tenta de novo, grava o mesmo
 * número. Contador incrementado derivaria na primeira falha.
 */
@Injectable()
export class ItemStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemService,
  ) {}

  async recompute(itemId: string): Promise<ItemStats> {
    const [firstTries, correctFirstTries] = await Promise.all([
      this.prisma.answer.count({ where: { itemId, isFirstTry: true } }),
      this.prisma.answer.count({
        where: { itemId, isFirstTry: true, isCorrect: true },
      }),
    ]);

    const stats = computeItemStats({ firstTries, correctFirstTries });

    await this.items.applyStats(itemId, stats);

    return stats;
  }
}
