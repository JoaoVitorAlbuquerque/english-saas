import { Injectable, Logger } from '@nestjs/common';
import type { CefrLevel, ItemType } from '@prisma/client';
import {
  itemCalibrationFlagSchema,
  type ItemCalibrationFlag,
  type Paginated,
} from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, decodeCursor } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';
import { AnswerService } from 'src/modules/learning/services/answer.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';

import { CALIBRATION_RULES, calibrateItem } from '../domain/calibration';
import { initialDifficultyOf, latestPerItem } from '../domain/flagged';

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

  /**
   * O que o editor precisa olhar: **um item por linha**, com o resumo dele e
   * o que a calibração mais recente ainda não resolvida marcou. Filtra por
   * marca, nível e tipo; mais recente primeiro.
   *
   * Lê as marcações abertas inteiras e pagina em memória: são poucas (só o
   * que a calibração semanal sinalizou e ninguém resolveu) e o filtro de
   * nível e tipo mora no item, que é de outro módulo.
   */
  async listFlagged(query: {
    cursor?: string | undefined;
    limit: number;
    flag?: ItemCalibrationFlag | undefined;
    level?: CefrLevel | undefined;
    type?: ItemType | undefined;
  }): Promise<Paginated<unknown>> {
    const open = await this.prisma.itemCalibration.findMany({
      where: { resolvedAt: null, NOT: { flags: { isEmpty: true } } },
    });
    const latest = latestPerItem(
      open.map((row) => ({ ...row, flags: toFlags(row.flags) })),
    ).filter(
      (row) => query.flag === undefined || row.flags.includes(query.flag),
    );
    const summaries = new Map(
      (await this.items.findSummaries(latest.map((row) => row.itemId))).map(
        (item) => [item.id, item],
      ),
    );

    const rows = latest.flatMap((row) => {
      const item = summaries.get(row.itemId);

      if (
        item === undefined ||
        (query.level !== undefined && item.cefrLevel !== query.level) ||
        (query.type !== undefined && item.type !== query.type)
      ) {
        return [];
      }

      return [
        {
          item,
          flags: row.flags,
          pValue: row.pValue,
          pointBiserial: row.pointBiserial,
          responses: row.responses,
          previousDifficulty: row.previousDifficulty,
          appliedDifficulty: row.appliedDifficulty,
          calibratedAt: row.calibratedAt,
        },
      ];
    });

    const after =
      query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const start =
      after === undefined
        ? 0
        : rows.findIndex((row) => row.item.id === after) + 1;

    return buildPage(
      rows.slice(start, start + query.limit + 1),
      query.limit,
      (row) => row.item.id,
    );
  }

  /**
   * A ficha de estatística de um item: exposição, acerto, dificuldade
   * inicial × atual, o que está marcado e a história das calibrações.
   */
  async itemStats(itemId: string) {
    const [item] = await this.items.findSummaries([itemId]);

    if (item === undefined) {
      throw new NotFoundError('Não encontramos esta questão.');
    }

    const calibrations = await this.prisma.itemCalibration.findMany({
      where: { itemId },
      orderBy: { calibratedAt: 'asc' },
    });
    const history = calibrations.map((row) => ({
      calibratedAt: row.calibratedAt,
      responses: row.responses,
      pValue: row.pValue,
      estimatedDifficulty: row.estimatedDifficulty,
      previousDifficulty: row.previousDifficulty,
      appliedDifficulty: row.appliedDifficulty,
      pointBiserial: row.pointBiserial,
      flags: toFlags(row.flags),
      resolvedAt: row.resolvedAt,
    }));
    const openFlagged = latestPerItem(
      history
        .filter((row) => row.resolvedAt === null && row.flags.length > 0)
        .map((row) => ({ ...row, itemId })),
    )[0];

    return {
      itemId,
      exposureCount: item.exposureCount,
      correctRate: item.correctRate,
      difficulty: item.difficulty,
      initialDifficulty: initialDifficultyOf(item.difficulty, history),
      discrimination: item.discrimination,
      /** O que está marcado e ninguém resolveu. Vazio = item sem alerta. */
      flags: openFlagged?.flags ?? [],
      lastCalibratedAt: history[history.length - 1]?.calibratedAt ?? null,
      history,
    };
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

/** `flags` é `String[]` no banco; só as que a calibração conhece contam. */
function toFlags(values: readonly string[]): ItemCalibrationFlag[] {
  return values.flatMap((value) => {
    const parsed = itemCalibrationFlagSchema.safeParse(value);

    return parsed.success ? [parsed.data] : [];
  });
}
