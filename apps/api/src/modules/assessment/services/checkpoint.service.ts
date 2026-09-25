import { Injectable, Logger } from '@nestjs/common';
import {
  AssessmentStatus,
  CheckpointResult,
  type Prisma,
  type UnitCheckpoint,
} from '@prisma/client';
import type { AnswerResponse, CefrLevel } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';

import {
  AssessmentClosedError,
  ItemNotCurrentError,
  NoItemsAvailableError,
} from '../assessment.errors';
import {
  CHECKPOINT_RULES,
  checkpointOutcome,
  checkpointShouldStop,
  nextCheckpointItem,
  type SkillOutcome,
} from '../domain/checkpoint';
import { AssessmentResponsesService } from './assessment-responses.service';

/** Quantos pontos fracos do aluno entram, além das skills da unidade. */
const MAX_WEAK_SKILLS = 3;

type SkillResults = Record<
  string,
  Partial<SkillOutcome> & { priorTheta: number }
>;

const RESULT_MESSAGES: Record<CheckpointResult, string> = {
  PASSED: 'Tudo certo com esta unidade. Pode seguir.',
  PASSED_WITH_REINFORCEMENT:
    'Você foi bem. Vale reforçar alguns pontos antes de seguir — ou siga e volte a eles depois.',
  NEEDS_REINFORCEMENT:
    'Alguns pontos desta unidade ainda não firmaram. Recomendamos revisar antes de seguir — mas a escolha é sua.',
};

/**
 * Checkpoint de unidade.
 *
 * Diagnóstico, nunca trava: pode ser refeito quando o aluno quiser, e o
 * resultado recomenda, não bloqueia (CLAUDE.md, regras de produto).
 */
@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemService,
    private readonly catalog: CatalogService,
    private readonly taxonomy: TaxonomyService,
    private readonly profiles: LearnerProfileService,
    private readonly responses: AssessmentResponsesService,
    private readonly events: EventBusService,
  ) {}

  async start(
    userId: string,
    unitId: string,
    random: () => number = Math.random,
  ) {
    const unit = await this.catalog.unitTargetSkills(unitId);
    const open = await this.prisma.unitCheckpoint.findFirst({
      where: { userId, unitId, status: AssessmentStatus.IN_PROGRESS },
    });

    if (open !== null) {
      return this.inProgressView(open);
    }

    const snapshot = await this.profiles.getSnapshot(userId);
    const weakSkillIds = snapshot.weaknesses.skills
      .map((skill) => skill.skillId)
      .filter((skillId) => !unit.skillIds.includes(skillId))
      .slice(0, MAX_WEAK_SKILLS);

    const skills = [...unit.skillIds, ...weakSkillIds];
    // O ponto de partida fica congelado aqui: as respostas do próprio
    // checkpoint também atualizam o learner-model, e ler de novo contaria
    // cada resposta duas vezes.
    const priors = await this.profiles.skillThetas(userId, skills);
    const candidates = await this.items.findCandidates({ skillIds: skills });

    const first = nextCheckpointItem({
      candidates,
      servedItemIds: new Set(),
      targetSkillIds: unit.skillIds,
      weakSkillIds,
      responses: [],
      priorThetas: priors,
      random,
    });

    if (first === null) {
      throw new NoItemsAvailableError();
    }

    const skillResults: SkillResults = Object.fromEntries(
      [...priors.entries()].map(([skillId, priorTheta]) => [
        skillId,
        { priorTheta },
      ]),
    );

    const created = await this.prisma.unitCheckpoint.create({
      data: {
        userId,
        unitId,
        targetSkillIds: unit.skillIds,
        weakSkillIds,
        currentItemId: first.item.id,
        servedItemIds: [first.item.id],
        reinforceSkillIds: [],
        skillResults: skillResults as unknown as Prisma.InputJsonValue,
      },
    });

    return this.inProgressView(created);
  }

  async answer(
    userId: string,
    checkpointId: string,
    input: {
      itemId: string;
      response: AnswerResponse;
      responseTimeMs: number;
      clientAnswerId?: string | undefined;
    },
    random: () => number = Math.random,
  ) {
    const checkpoint = await this.findOwned(userId, checkpointId);

    if (
      checkpoint.status === AssessmentStatus.COMPLETED &&
      checkpoint.servedItemIds.includes(input.itemId)
    ) {
      return this.resultView(checkpoint);
    }

    if (checkpoint.status !== AssessmentStatus.IN_PROGRESS) {
      throw new AssessmentClosedError(checkpoint.status);
    }

    if (input.itemId !== checkpoint.currentItemId) {
      if (checkpoint.servedItemIds.includes(input.itemId)) {
        return this.inProgressView(checkpoint);
      }

      throw new ItemNotCurrentError(checkpoint.currentItemId);
    }

    const skills = [...checkpoint.targetSkillIds, ...checkpoint.weakSkillIds];
    const candidates = await this.items.findCandidates({ skillIds: skills });
    const item = candidates.find((candidate) => candidate.id === input.itemId);

    if (item === undefined) {
      throw new NotFoundError('Esta questão não está mais disponível.');
    }

    const recorded = await this.responses.record({
      kind: 'CHECKPOINT',
      testId: checkpointId,
      userId,
      item,
      response: input.response,
      responseTimeMs: input.responseTimeMs,
      clientAnswerId: input.clientAnswerId,
    });

    if (!recorded) {
      return this.inProgressView(await this.findOwned(userId, checkpointId));
    }

    const answered = (await this.responses.list(checkpointId)).map((row) => ({
      difficulty: row.difficulty,
      correct: row.correct,
      skillIds: row.skillIds,
    }));
    const priors = priorsOf(checkpoint);
    const next = nextCheckpointItem({
      candidates,
      servedItemIds: new Set(checkpoint.servedItemIds),
      targetSkillIds: checkpoint.targetSkillIds,
      weakSkillIds: checkpoint.weakSkillIds,
      responses: answered,
      priorThetas: priors,
      random,
    });

    const stop = checkpointShouldStop({
      answered: answered.length,
      targetSkillIds: checkpoint.targetSkillIds,
      responses: answered,
      hasNextItem: next !== null,
    });

    if (stop || next === null) {
      return this.complete(checkpoint, answered, priors);
    }

    const updated = await this.prisma.unitCheckpoint.update({
      where: { id: checkpointId },
      data: {
        currentItemId: next.item.id,
        servedItemIds: { push: next.item.id },
      },
    });

    return this.inProgressView(updated);
  }

  // -------------------------------------------------------------------

  private async complete(
    checkpoint: UnitCheckpoint,
    answered: { difficulty: number; correct: boolean; skillIds: string[] }[],
    priors: Map<string, number>,
  ) {
    const unit = await this.catalog.unitTargetSkills(checkpoint.unitId);
    const outcome = checkpointOutcome({
      responses: answered,
      targetSkillIds: checkpoint.targetSkillIds,
      weakSkillIds: checkpoint.weakSkillIds,
      priorThetas: priors,
      unitLevel: unit.cefrLevel as CefrLevel,
    });

    const skillResults: SkillResults = Object.fromEntries(
      [...priors.entries()].map(([skillId, priorTheta]) => [
        skillId,
        { priorTheta, ...(outcome.skillResults[skillId] ?? {}) },
      ]),
    );

    const completed = await this.prisma.unitCheckpoint.update({
      where: { id: checkpoint.id },
      data: {
        status: AssessmentStatus.COMPLETED,
        completedAt: new Date(),
        currentItemId: null,
        result: outcome.result,
        score: outcome.score,
        reinforceSkillIds: outcome.reinforceSkillIds,
        skillResults: skillResults as unknown as Prisma.InputJsonValue,
      },
    });

    this.events.emit(
      'checkpoint.completed',
      {
        checkpointId: checkpoint.id,
        unitId: checkpoint.unitId,
        result: outcome.result,
        score: outcome.score,
        reinforceSkillIds: outcome.reinforceSkillIds,
        itemsAnswered: answered.length,
      },
      { userId: checkpoint.userId },
    );

    this.logger.log(
      { checkpointId: checkpoint.id, result: outcome.result },
      'Checkpoint concluído',
    );

    return this.resultView(completed);
  }

  private async findOwned(userId: string, checkpointId: string) {
    const checkpoint = await this.prisma.unitCheckpoint.findUnique({
      where: { id: checkpointId },
    });

    if (checkpoint?.userId !== userId) {
      throw new NotFoundError('Não encontramos este checkpoint.');
    }

    return checkpoint;
  }

  private async inProgressView(checkpoint: UnitCheckpoint) {
    const [item] =
      checkpoint.currentItemId === null
        ? []
        : await this.catalog.studentItems([checkpoint.currentItemId]);

    return {
      id: checkpoint.id,
      unitId: checkpoint.unitId,
      status: checkpoint.status,
      answered: Math.max(0, checkpoint.servedItemIds.length - 1),
      maxItems: CHECKPOINT_RULES.maxItems,
      next: item ?? null,
      result: null,
    };
  }

  private async resultView(checkpoint: UnitCheckpoint) {
    const graph = await this.taxonomy.skillGraph();
    const titles = new Map(graph.map((node) => [node.id, node.title]));
    const result = checkpoint.result;

    return {
      id: checkpoint.id,
      unitId: checkpoint.unitId,
      status: checkpoint.status,
      answered: checkpoint.servedItemIds.length,
      maxItems: CHECKPOINT_RULES.maxItems,
      next: null,
      result:
        result === null
          ? null
          : {
              result,
              message: RESULT_MESSAGES[result],
              score: checkpoint.score,
              reinforce: checkpoint.reinforceSkillIds.map((skillId) => ({
                skillId,
                title: titles.get(skillId) ?? skillId,
              })),
              completedAt: checkpoint.completedAt,
            },
    };
  }
}

function priorsOf(checkpoint: UnitCheckpoint): Map<string, number> {
  const raw = (checkpoint.skillResults ?? {}) as Record<
    string,
    { priorTheta?: unknown }
  >;

  return new Map(
    Object.entries(raw).flatMap(([skillId, entry]) =>
      typeof entry.priorTheta === 'number'
        ? [[skillId, entry.priorTheta] as const]
        : [],
    ),
  );
}
