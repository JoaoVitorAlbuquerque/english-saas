import { Injectable, Logger } from '@nestjs/common';
import type { Paginated } from '@english-saas/shared';

import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';
import { AnswerService } from 'src/modules/learning/services/answer.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';

import { CALIBRATION_RULES, calibrateItem } from '../domain/calibration';

export const ITEM_CALIBRATION_JOB = 'item-calibration';

/** Itens por lote: limita o tamanho da consulta de respostas. */
const CHUNK = 50;

/**
 * Calibração semanal.
 *
 * Reestima a dificuldade dos itens com exposição suficiente, aplica com
 * passo limitado e marca para o editor o que estiver fácil demais,
 * difícil demais ou discriminando mal. Cada rodada fica registrada em
 * `item_calibrations` — dá para ver como a dificuldade de um item andou.
 */
@Injectable()
export class CalibrationService {
  private readonly logger = new Logger(CalibrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemService,
    private readonly answers: AnswerService,
    private readonly profiles: LearnerProfileService,
  ) {}

  async run(
    now: Date = new Date(),
  ): Promise<{ calibrated: number; flagged: number }> {
    const items = await this.items.findCalibratable(
      CALIBRATION_RULES.minResponses,
    );
    let calibrated = 0;
    let flagged = 0;

    for (let start = 0; start < items.length; start += CHUNK) {
      const chunk = items.slice(start, start + CHUNK);
      const tries = await this.answers.firstTriesForItems(
        chunk.map((item) => item.id),
      );

      for (const item of chunk) {
        if (item.primarySkillId === null) continue;

        const own = tries.filter((row) => row.itemId === item.id);
        const abilities = await this.profiles.abilities(
          own.map((row) => row.userId),
          item.primarySkillId,
          now,
        );

        const result = calibrateItem({
          currentDifficulty: item.difficulty,
          responses: own.flatMap((row) => {
            const ability = abilities.get(row.userId);
            return ability === undefined
              ? []
              : [{ ability, correct: row.isCorrect }];
          }),
        });

        if (result === null) continue;

        if (result.appliedDifficulty !== item.difficulty) {
          await this.items.applyCalibration(item.id, result.appliedDifficulty);
        }

        await this.prisma.itemCalibration.create({
          data: {
            itemId: item.id,
            responses: result.responses,
            pValue: result.pValue,
            estimatedDifficulty: result.estimatedDifficulty,
            previousDifficulty: item.difficulty,
            appliedDifficulty: result.appliedDifficulty,
            pointBiserial: result.pointBiserial,
            flags: result.flags,
            calibratedAt: now,
          },
        });

        calibrated += 1;
        if (result.flags.length > 0) flagged += 1;
      }
    }

    this.logger.log({ calibrated, flagged }, 'Calibração de itens concluída');

    return { calibrated, flagged };
  }

  /** O que o editor precisa olhar: marcações ainda não resolvidas. */
  async listFlagged(query: {
    cursor?: string | undefined;
    limit: number;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.itemCalibration.findMany({
      take,
      ...cursorArgs,
      where: { resolvedAt: null, NOT: { flags: { isEmpty: true } } },
      orderBy: { id: 'asc' },
    });

    return buildPage(rows, query.limit, (row) => row.id);
  }

  /** O editor viu e resolveu (corrigiu o item, ou decidiu que está certo). */
  async resolve(
    itemId: string,
    editorId: string,
  ): Promise<{ resolved: number }> {
    const { count } = await this.prisma.itemCalibration.updateMany({
      where: { itemId, resolvedAt: null, NOT: { flags: { isEmpty: true } } },
      data: { resolvedAt: new Date(), resolvedById: editorId },
    });

    return { resolved: count };
  }
}
