import { Injectable, Logger } from '@nestjs/common';
import type { Competency, Prisma } from '@prisma/client';
import type { Paginated } from '@english-saas/shared';

import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { AttemptService } from 'src/modules/learning/services/attempt.service';
import { UsersService } from 'src/modules/users/services/users.service';

import type { ErrorExample, ErrorState } from '../domain/error-profile';
import { buildLearnerModel, type LearnerModel } from '../domain/learner-model';
import {
  decayedTheta,
  initialSkillState,
  masteryOf,
  type SkillState,
} from '../domain/mastery';
import {
  priorThetaFor,
  priorThetasBySkill,
  type PlacementPrior,
} from '../domain/placement-prior';
import { classifySkill } from '../domain/profile';
import {
  buildSnapshot,
  buildStudentProfile,
  SNAPSHOT_VERSION,
  type LearnerSnapshot,
  type StudentProfile,
} from '../domain/snapshot';

/** Uma hora: o cache é apagado a cada atualização, o TTL é só rede de segurança. */
const SNAPSHOT_TTL_SECONDS = 3_600;

/**
 * Leitura do modelo do aluno.
 *
 * `getSnapshot` é o que os outros módulos chamam antes de gerar ou
 * recomendar qualquer coisa (CLAUDE.md: "tudo que é gerado ou recomendado
 * consulta esse modelo"). Fica em cache no Redis, com a versão do formato na
 * chave, e é apagado sempre que o modelo muda.
 */
@Injectable()
export class LearnerProfileService {
  private readonly logger = new Logger(LearnerProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly taxonomy: TaxonomyService,
    private readonly users: UsersService,
    private readonly attempts: AttemptService,
  ) {}

  static cacheKey(userId: string): string {
    return `learner:snapshot:v${String(SNAPSHOT_VERSION)}:${userId}`;
  }

  async getSnapshot(userId: string): Promise<LearnerSnapshot> {
    const key = LearnerProfileService.cacheKey(userId);
    const cached = await this.redis.client.get(key);

    if (cached !== null) {
      try {
        return JSON.parse(cached) as LearnerSnapshot;
      } catch {
        this.logger.warn(
          { userId },
          'Snapshot em cache inválido — recalculando',
        );
      }
    }

    const [{ model, context }, recentTopics] = await Promise.all([
      this.computeModel(userId),
      this.attempts.recentLessonTitles(userId),
    ]);

    const snapshot = buildSnapshot({
      model,
      interests: context.interests,
      goals: context.goals,
      recentTopics,
    });

    await this.redis.client.set(
      key,
      JSON.stringify(snapshot),
      'EX',
      SNAPSHOT_TTL_SECONDS,
    );

    return snapshot;
  }

  async getProfile(userId: string): Promise<StudentProfile> {
    const { model, context } = await this.computeModel(userId);
    return buildStudentProfile({ model, goals: context.goals });
  }

  /** Mastery por skill, paginado por cursor. */
  async listSkills(
    userId: string,
    query: {
      competency?: Competency | undefined;
      cursor?: string | undefined;
      limit: number;
    },
  ): Promise<Paginated<unknown>> {
    const graph = await this.taxonomy.skillGraph();
    const nodes = new Map(graph.map((node) => [node.id, node]));
    const skillIds = graph
      .filter(
        (node) =>
          query.competency === undefined ||
          node.competency === query.competency,
      )
      .map((node) => node.id);

    const { take, ...cursorArgs } = toPrismaCursorArgs(query);
    const rows = await this.prisma.learnerSkillState.findMany({
      take,
      ...cursorArgs,
      where: { userId, skillId: { in: skillIds } },
      orderBy: { id: 'asc' },
    });

    const page = buildPage(rows, query.limit, (row) => row.id);
    const now = new Date();

    return {
      ...page,
      data: page.data.flatMap((row) => {
        const node = nodes.get(row.skillId);
        if (node === undefined) return [];

        const mastery = masteryOf(toSkillState(row), node.cefrLevel, now);

        return [
          {
            skillId: row.skillId,
            title: node.title,
            competency: node.competency,
            cefrLevel: node.cefrLevel,
            mastery: Math.round(mastery * 1000) / 1000,
            evidence: row.evidenceCount,
            status: classifySkill({
              skillId: row.skillId,
              mastery,
              evidence: row.evidenceCount,
            }),
            lastPracticedAt: row.lastPracticedAt,
          },
        ];
      }),
    };
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.client.del(LearnerProfileService.cacheKey(userId));
  }

  /** Monta o modelo inteiro do aluno a partir do banco. */
  async computeModel(userId: string, now = new Date()) {
    const [graph, skillRows, errorRows, context, placementPrior] =
      await Promise.all([
        this.taxonomy.skillGraph(),
        this.prisma.learnerSkillState.findMany({ where: { userId } }),
        this.prisma.learnerErrorPattern.findMany({ where: { userId } }),
        this.users.learnerContext(userId),
        this.placementPrior(userId),
      ]);

    const errorStates = new Map(
      errorRows.map((row) => [row.errorPatternId, toErrorState(row)]),
    );
    const errorPatterns = await this.taxonomy.errorPatternSummaries([
      ...errorStates.keys(),
    ]);

    const model: LearnerModel = buildLearnerModel({
      now,
      graph,
      skillStates: new Map(
        skillRows.map((row) => [row.skillId, toSkillState(row)]),
      ),
      errorStates,
      errorPatterns,
      goals: context.goals,
      selfReportedLevel: context.selfReportedLevel,
      placementPrior,
    });

    return { model, context };
  }

  async placementPrior(userId: string): Promise<PlacementPrior | null> {
    const row = await this.prisma.learnerPlacementPrior.findUnique({
      where: { userId },
    });

    return row === null ? null : toPlacementPrior(row);
  }

  /**
   * Theta atual do aluno em cada skill pedida, com o decaimento de leitura.
   * Skill sem estado usa o ponto de partida — o do nivelamento, se houver,
   * senão a dificuldade típica do nível dela.
   *
   * É o que o assessment (8) usa para nivelar questões: `selectItems` e o
   * checkpoint miram a dificuldade a partir daqui.
   */
  async skillThetas(
    userId: string,
    skillIds: readonly string[],
    now = new Date(),
  ): Promise<Map<string, number>> {
    if (skillIds.length === 0) {
      return new Map();
    }

    const [graph, rows, prior] = await Promise.all([
      this.taxonomy.skillGraph(),
      this.prisma.learnerSkillState.findMany({
        where: { userId, skillId: { in: [...skillIds] } },
      }),
      this.placementPrior(userId),
    ]);

    const nodes = new Map(graph.map((node) => [node.id, node]));
    const states = new Map(rows.map((row) => [row.skillId, toSkillState(row)]));
    const priors = priorThetasBySkill(prior, graph);

    return new Map(
      skillIds.flatMap((skillId) => {
        const node = nodes.get(skillId);
        if (node === undefined) return [];

        const state =
          states.get(skillId) ??
          initialSkillState(node.cefrLevel, priors.get(skillId));

        return [[skillId, decayedTheta(state, now)] as const];
      }),
    );
  }

  /**
   * Mastery (0–1) e evidência de várias skills, em lote — o planner (10) usa
   * pra decidir que lição pular ("target skills já dominadas"). Mesma busca
   * de `skillThetas`, só que devolve a mastery pronta em vez do theta cru.
   */
  async masteryBySkill(
    userId: string,
    skillIds: readonly string[],
    now = new Date(),
  ): Promise<Map<string, { mastery: number; evidence: number }>> {
    if (skillIds.length === 0) {
      return new Map();
    }

    const [graph, rows, prior] = await Promise.all([
      this.taxonomy.skillGraph(),
      this.prisma.learnerSkillState.findMany({
        where: { userId, skillId: { in: [...skillIds] } },
      }),
      this.placementPrior(userId),
    ]);

    const nodes = new Map(graph.map((node) => [node.id, node]));
    const states = new Map(rows.map((row) => [row.skillId, toSkillState(row)]));
    const priors = priorThetasBySkill(prior, graph);

    return new Map(
      skillIds.flatMap((skillId) => {
        const node = nodes.get(skillId);
        if (node === undefined) return [];

        const state =
          states.get(skillId) ??
          initialSkillState(node.cefrLevel, priors.get(skillId));

        return [
          [
            skillId,
            {
              mastery: masteryOf(state, node.cefrLevel, now),
              evidence: state.evidenceCount,
            },
          ] as const,
        ];
      }),
    );
  }

  /**
   * Habilidade de vários alunos numa skill, para a calibração (8). Mesma
   * regra de `skillThetas`, em lote.
   */
  async abilities(
    userIds: readonly string[],
    skillId: string,
    now = new Date(),
  ): Promise<Map<string, number>> {
    const unique = [...new Set(userIds)];

    if (unique.length === 0) {
      return new Map();
    }

    const [graph, rows, priors] = await Promise.all([
      this.taxonomy.skillGraph(),
      this.prisma.learnerSkillState.findMany({
        where: { skillId, userId: { in: unique } },
      }),
      this.prisma.learnerPlacementPrior.findMany({
        where: { userId: { in: unique } },
      }),
    ]);

    const node = graph.find((candidate) => candidate.id === skillId);

    if (node === undefined) {
      return new Map();
    }

    const states = new Map(rows.map((row) => [row.userId, toSkillState(row)]));
    const priorByUser = new Map(
      priors.map((row) => [row.userId, toPlacementPrior(row)]),
    );

    return new Map(
      unique.map((userId) => {
        const prior = priorByUser.get(userId);
        const state =
          states.get(userId) ??
          initialSkillState(
            node.cefrLevel,
            prior === undefined
              ? undefined
              : priorThetaFor(prior, node.competency),
          );

        return [userId, decayedTheta(state, now)] as const;
      }),
    );
  }
}

export function toPlacementPrior(row: {
  overallTheta: number;
  competencyThetas: Prisma.JsonValue;
}): PlacementPrior {
  const raw =
    row.competencyThetas !== null &&
    typeof row.competencyThetas === 'object' &&
    !Array.isArray(row.competencyThetas)
      ? (row.competencyThetas as Record<string, unknown>)
      : {};

  return {
    overallTheta: row.overallTheta,
    competencyThetas: Object.fromEntries(
      Object.entries(raw).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
      ),
    ) as PlacementPrior['competencyThetas'],
  };
}

export function toSkillState(row: {
  theta: number;
  evidenceCount: number;
  correctStreak: number;
  lastPracticedAt: Date | null;
}): SkillState {
  return {
    theta: row.theta,
    evidenceCount: row.evidenceCount,
    correctStreak: row.correctStreak,
    lastPracticedAt: row.lastPracticedAt,
  };
}

export function toErrorState(row: {
  recentOutcomes: boolean[];
  totalOccurrences: number;
  lastOccurredAt: Date | null;
  examples: Prisma.JsonValue;
}): ErrorState {
  return {
    recentOutcomes: row.recentOutcomes,
    totalOccurrences: row.totalOccurrences,
    lastOccurredAt: row.lastOccurredAt,
    examples: Array.isArray(row.examples)
      ? (row.examples as unknown as ErrorExample[])
      : [],
  };
}
