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
import { masteryOf, type SkillState } from '../domain/mastery';
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
    const [graph, skillRows, errorRows, context] = await Promise.all([
      this.taxonomy.skillGraph(),
      this.prisma.learnerSkillState.findMany({ where: { userId } }),
      this.prisma.learnerErrorPattern.findMany({ where: { userId } }),
      this.users.learnerContext(userId),
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
    });

    return { model, context };
  }
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
