import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import type { CefrLevel, Competency, Prisma } from '@prisma/client';

import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { AnswerService } from 'src/modules/learning/services/answer.service';

import { applyAnswers, type ModelItem } from '../domain/apply-answers';
import { weekStartOf } from '../domain/competency-level';
import type { ErrorState } from '../domain/error-profile';
import type { SkillState } from '../domain/mastery';
import {
  adjustToPlacement,
  priorThetasBySkill,
  type PlacementPrior,
} from '../domain/placement-prior';
import {
  LearnerProfileService,
  toErrorState,
  toSkillState,
} from './learner-profile.service';

export const LEARNER_UPDATE_JOB = 'learner-update';
export const PLACEMENT_PRIOR_JOB = 'placement-prior';

/** Respostas lidas por volta. Um aluno ativo gera dezenas por dia, não milhares. */
const BATCH_SIZE = 200;
/** A trava expira sozinha se o worker morrer segurando. */
const LOCK_TTL_MS = 60_000;

/** Solta a trava só se ainda for nossa — ela pode ter expirado e sido pega. */
const RELEASE_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0`;

export type UpdateOutcome =
  { status: 'LOCKED' } | { status: 'DONE'; processed: number };

/**
 * Atualiza o modelo do aluno a partir das respostas novas.
 *
 * **Ordem por aluno sem agrupamento de fila.** O BullMQ só agrupa jobs por
 * chave na versão paga, então a ordem é garantida por duas peças:
 *
 * 1. uma **trava no Redis por aluno** — dois workers nunca processam o
 *    mesmo aluno ao mesmo tempo;
 * 2. uma **marca d'água** (`LearnerModelCursor`) — quem pega a trava
 *    processa *todas* as respostas depois da marca, em ordem de criação.
 *
 * Cada resposta enfileira o próprio job, então nenhuma fica para trás; o
 * job de uma resposta já processada por outro simplesmente não acha nada
 * novo. Reprocessar é seguro: a marca só anda junto com a escrita.
 */
@Injectable()
export class LearnerUpdateService {
  private readonly logger = new Logger(LearnerUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly answers: AnswerService,
    private readonly items: ItemService,
    private readonly taxonomy: TaxonomyService,
    private readonly profiles: LearnerProfileService,
    private readonly events: EventBusService,
  ) {}

  static lockKey(userId: string): string {
    return `learner:lock:${userId}`;
  }

  async process(userId: string): Promise<UpdateOutcome> {
    return this.withLock(userId, async () => ({
      status: 'DONE',
      processed: await this.drain(userId),
    }));
  }

  /**
   * Aplica o resultado do nivelamento (8) como ponto de partida, sob a
   * mesma trava das respostas — as respostas do próprio nivelamento chegam
   * pela fila ao mesmo tempo, e as duas escritas não podem se cruzar.
   */
  async applyPlacement(
    userId: string,
    placement: {
      placementId: string;
      theta: number;
      competencyThetas: Partial<Record<Competency, number>>;
      completedAt: Date;
    },
  ): Promise<UpdateOutcome> {
    return this.withLock(userId, async () => {
      const prior: PlacementPrior = {
        overallTheta: placement.theta,
        competencyThetas: placement.competencyThetas,
      };
      const data = {
        placementId: placement.placementId,
        overallTheta: prior.overallTheta,
        competencyThetas:
          prior.competencyThetas as unknown as Prisma.InputJsonValue,
        placedAt: placement.completedAt,
      };

      const [graph, rows] = await Promise.all([
        this.taxonomy.skillGraph(),
        this.prisma.learnerSkillState.findMany({ where: { userId } }),
      ]);
      const changed = adjustToPlacement(
        new Map(rows.map((row) => [row.skillId, toSkillState(row)])),
        priorThetasBySkill(prior, graph),
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.learnerPlacementPrior.upsert({
          where: { userId },
          create: { userId, ...data },
          update: data,
        });

        for (const [skillId, state] of changed) {
          await tx.learnerSkillState.update({
            where: { userId_skillId: { userId, skillId } },
            data: { theta: state.theta },
          });
        }
      });

      await this.afterUpdate(userId, 0, new Set(changed.keys()), new Set());

      return { status: 'DONE', processed: 0 };
    });
  }

  private async withLock(
    userId: string,
    work: () => Promise<UpdateOutcome>,
  ): Promise<UpdateOutcome> {
    const key = LearnerUpdateService.lockKey(userId);
    const token = randomUUID();
    const acquired = await this.redis.client.set(
      key,
      token,
      'PX',
      LOCK_TTL_MS,
      'NX',
    );

    if (acquired === null) {
      return { status: 'LOCKED' };
    }

    try {
      return await work();
    } finally {
      await this.redis.client.eval(RELEASE_LOCK, 1, key, token);
    }
  }

  private async drain(userId: string): Promise<number> {
    const [graph, prior] = await Promise.all([
      this.taxonomy.skillGraph(),
      this.profiles.placementPrior(userId),
    ]);
    const priorThetas = priorThetasBySkill(prior, graph);
    const skillLevels = new Map<string, CefrLevel>(
      graph.map((node) => [node.id, node.cefrLevel]),
    );
    const errorPatternsBySkill = new Map(
      graph.map((node) => [node.id, node.errorPatternIds]),
    );

    const touchedSkills = new Set<string>();
    const touchedErrors = new Set<string>();
    let processed = 0;

    for (;;) {
      const cursor = await this.prisma.learnerModelCursor.findUnique({
        where: { userId },
      });
      const batch = await this.answers.listSince(
        userId,
        cursor?.lastAnswerAt != null && cursor.lastAnswerId != null
          ? { at: cursor.lastAnswerAt, id: cursor.lastAnswerId }
          : null,
        BATCH_SIZE,
      );

      const last = batch.at(-1);

      if (last === undefined) {
        break;
      }

      const items = new Map<string, ModelItem>(
        (
          await this.items.findManyForModel([
            ...new Set(batch.map((a) => a.itemId)),
          ])
        ).map((item) => [item.id, item]),
      );

      const skillIds = [
        ...new Set([...items.values()].flatMap((item) => item.skillIds)),
      ];
      const [skillRows, errorRows] = await Promise.all([
        this.prisma.learnerSkillState.findMany({
          where: { userId, skillId: { in: skillIds } },
        }),
        this.prisma.learnerErrorPattern.findMany({ where: { userId } }),
      ]);

      const result = applyAnswers({
        answers: batch,
        items,
        skillLevels,
        errorPatternsBySkill,
        skillStates: new Map<string, SkillState>(
          skillRows.map((row) => [row.skillId, toSkillState(row)]),
        ),
        errorStates: new Map<string, ErrorState>(
          errorRows.map((row) => [row.errorPatternId, toErrorState(row)]),
        ),
        priorThetas,
      });

      await this.prisma.$transaction(async (tx) => {
        for (const skillId of result.touchedSkills) {
          const state = result.skillStates.get(skillId);
          if (state === undefined) continue;

          await tx.learnerSkillState.upsert({
            where: { userId_skillId: { userId, skillId } },
            create: { userId, skillId, ...state },
            update: state,
          });
        }

        for (const errorPatternId of result.touchedErrors) {
          const state = result.errorStates.get(errorPatternId);
          if (state === undefined) continue;

          const data = {
            recentOutcomes: state.recentOutcomes,
            totalOccurrences: state.totalOccurrences,
            lastOccurredAt: state.lastOccurredAt,
            examples: state.examples as unknown as Prisma.InputJsonValue,
          };

          await tx.learnerErrorPattern.upsert({
            where: { userId_errorPatternId: { userId, errorPatternId } },
            create: { userId, errorPatternId, ...data },
            update: data,
          });
        }

        // A marca anda na mesma transação da escrita: se algo falhar, o
        // lote inteiro é refeito na próxima, sem contar nada duas vezes.
        await tx.learnerModelCursor.upsert({
          where: { userId },
          create: {
            userId,
            lastAnswerAt: last.createdAt,
            lastAnswerId: last.id,
          },
          update: { lastAnswerAt: last.createdAt, lastAnswerId: last.id },
        });
      });

      result.touchedSkills.forEach((id) => touchedSkills.add(id));
      result.touchedErrors.forEach((id) => touchedErrors.add(id));
      processed += batch.length;

      if (batch.length < BATCH_SIZE) {
        break;
      }
    }

    if (processed > 0) {
      await this.afterUpdate(userId, processed, touchedSkills, touchedErrors);
    }

    return processed;
  }

  /** Foto da semana, cache apagado e aviso para quem escuta. */
  private async afterUpdate(
    userId: string,
    processed: number,
    skillIds: ReadonlySet<string>,
    errorPatternIds: ReadonlySet<string>,
  ): Promise<void> {
    const now = new Date();
    const { model } = await this.profiles.computeModel(userId, now);
    const weekStart = new Date(`${weekStartOf(now)}T00:00:00.000Z`);
    const data = {
      overallLevel:
        model.overall.source === 'MODEL' ? model.overall.level : null,
      levels: model.levels as unknown as Prisma.InputJsonValue,
    };

    await this.prisma.learnerLevelSnapshot.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: { userId, weekStart, ...data },
      update: data,
    });

    await this.profiles.invalidate(userId);

    this.events.emit(
      'learner.model_updated',
      {
        processedAnswers: processed,
        skillIds: [...skillIds].sort(),
        errorPatternIds: [...errorPatternIds].sort(),
        overallLevel: model.overall.level,
      },
      { userId },
    );

    this.logger.log({ userId, processed }, 'Modelo do aluno atualizado');
  }
}
