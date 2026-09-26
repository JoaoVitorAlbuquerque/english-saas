import { Injectable } from '@nestjs/common';
import {
  LessonAttemptStatus,
  type CefrLevel,
  type Prisma,
  type StudyPlan,
} from '@prisma/client';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { withLock } from 'src/infra/redis/user-lock';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  buildPath,
  type PathEntry,
  type PlanForecast,
  type SkillNode,
} from '../domain/build-path';
import { needsRecalculation, weeksBehind } from '../domain/pacing';

/** Uma reconstrução por vez, por aluno — evento e cron não podem se cruzar. */
const LOCK_TTL_MS = 30_000;
const LOCK_RETRY_ATTEMPTS = 5;
const LOCK_RETRY_MS = 200;

export type RebuildOutcome =
  { status: 'LOCKED' } | { status: 'DONE'; plan: StudyPlan };

/**
 * Monta e mantém o `StudyPlan`.
 *
 * `rebuild` é uma reconstrução completa e idempotente a partir do estado
 * atual — nunca um diff incremental. Fica seguro reprocessar: refazer o
 * plano duas vezes seguidas dá o mesmo resultado (mesmo learner-model, mesmo
 * catálogo).
 */
@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly catalog: CatalogService,
    private readonly taxonomy: TaxonomyService,
    private readonly profiles: LearnerProfileService,
    private readonly users: UsersService,
  ) {}

  static lockKey(userId: string): string {
    return `planner:lock:${userId}`;
  }

  /** O plano, ou `null` se o aluno ainda não tem um. */
  async findPlan(userId: string): Promise<StudyPlan | null> {
    return this.prisma.studyPlan.findUnique({ where: { userId } });
  }

  async getPlan(userId: string): Promise<StudyPlan> {
    const plan = await this.prisma.studyPlan.findUnique({ where: { userId } });

    if (plan === null) {
      throw new NotFoundError(
        'Você ainda não tem um plano — monte um em POST /me/plan/rebuild.',
      );
    }

    return plan;
  }

  /**
   * Reconstrói do zero. Sob a trava do aluno: o cron diário, um evento
   * (placement, perfil editado) e o `user.onboarded` que acabou de disparar
   * este mesmo rebuild em segundo plano podem tentar ao mesmo tempo.
   *
   * Tenta de novo algumas vezes antes de devolver `LOCKED` — a montagem em
   * si é rápida (curso pequeno, sem chamada de IA), então vale a pena
   * esperar em vez de mandar o chamador ler um plano que ainda não existe.
   */
  async rebuild(
    userId: string,
    targetLevel?: CefrLevel,
  ): Promise<RebuildOutcome> {
    for (let attempt = 0; attempt < LOCK_RETRY_ATTEMPTS; attempt += 1) {
      const outcome = await withLock(
        this.redis,
        PlanService.lockKey(userId),
        LOCK_TTL_MS,
        async () => this.doRebuild(userId, targetLevel),
      );

      if (outcome.status === 'DONE') {
        return { status: 'DONE', plan: outcome.result };
      }

      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }

    return { status: 'LOCKED' };
  }

  /** Acrescenta skills de reforço (checkpoint com reforço necessário) sem refazer o path inteiro. */
  async addReinforcement(
    userId: string,
    skillIds: readonly string[],
  ): Promise<void> {
    if (skillIds.length === 0) {
      return;
    }

    await withLock(
      this.redis,
      PlanService.lockKey(userId),
      LOCK_TTL_MS,
      async () => {
        const existing = await this.prisma.studyPlan.findUnique({
          where: { userId },
        });

        if (existing === null) {
          return;
        }

        const merged = [
          ...new Set([...existing.reinforceSkillIds, ...skillIds]),
        ];

        await this.prisma.studyPlan.update({
          where: { userId },
          data: { reinforceSkillIds: merged },
        });
      },
    );
  }

  /** Tira uma lição do path se ela estava lá — o aluno já fez, de algum jeito. */
  async removeFromPath(userId: string, lessonId: string): Promise<void> {
    await withLock(
      this.redis,
      PlanService.lockKey(userId),
      LOCK_TTL_MS,
      async () => {
        const existing = await this.prisma.studyPlan.findUnique({
          where: { userId },
        });

        if (existing === null) {
          return;
        }

        const path = existing.path as unknown as { lessonId: string }[];

        if (!path.some((entry) => entry.lessonId === lessonId)) {
          return;
        }

        await this.prisma.studyPlan.update({
          where: { userId },
          data: {
            path: path.filter(
              (entry) => entry.lessonId !== lessonId,
            ) as unknown as Prisma.InputJsonValue,
          },
        });
      },
    );
  }

  /**
   * Quanto o ritmo real ficou atrás do previsto desde o último rebuild —
   * `pacing.weeksBehind` sobre a mesma aproximação: minutos do path que
   * havia então, minutos concluídos desde então.
   */
  async paceStatus(
    userId: string,
    now = new Date(),
  ): Promise<{ weeksBehind: number; message: string | null }> {
    const plan = await this.getPlan(userId);
    const forecast = plan.forecast as unknown as PlanForecast | null;

    if (forecast === null || forecast.weeksNeeded === null) {
      return { weeksBehind: 0, message: null };
    }

    const pathEntries = plan.path as unknown as PathEntry[];
    const totalMinutesPlanned = pathEntries.reduce(
      (sum, entry) => sum + entry.estimatedMinutes,
      0,
    );

    const completed = await this.prisma.lessonAttempt.findMany({
      where: {
        userId,
        status: LessonAttemptStatus.COMPLETED,
        completedAt: { gte: plan.updatedAt },
      },
      select: { lessonVersion: { select: { estimatedMinutes: true } } },
    });
    const completedMinutes = completed.reduce(
      (sum, attempt) => sum + attempt.lessonVersion.estimatedMinutes,
      0,
    );

    const weeks = weeksBehind({
      planCreatedAt: plan.updatedAt,
      now,
      expectedWeeksTotal: forecast.weeksNeeded,
      completedMinutes,
      totalMinutesPlanned,
    });

    return {
      weeksBehind: Math.round(weeks * 10) / 10,
      message: needsRecalculation(weeks)
        ? `Você está cerca de ${String(Math.round(weeks))} semana(s) atrás do ritmo esperado — vale refazer o plano.`
        : null,
    };
  }

  private async doRebuild(
    userId: string,
    targetLevel?: CefrLevel,
  ): Promise<StudyPlan> {
    const [profile, snapshot, courseLessons, graph, existing] =
      await Promise.all([
        this.users.getProfile(userId),
        this.profiles.getSnapshot(userId),
        this.catalog.publishedCoursePath(),
        this.taxonomy.skillGraph(),
        this.prisma.studyPlan.findUnique({ where: { userId } }),
      ]);

    const level = targetLevel ?? existing?.targetLevel ?? 'C1';
    const skillIds = [
      ...new Set(courseLessons.flatMap((lesson) => lesson.targetSkillIds)),
    ];
    const mastery = await this.profiles.masteryBySkill(userId, skillIds);
    const skillGraph = new Map<string, SkillNode>(
      graph.map((node) => [node.id, node]),
    );

    const result = buildPath({
      courseLessons,
      skillGraph,
      masteryBySkill: mastery,
      weaknessSkillIds: snapshot.weaknesses.skills.map(
        (skill) => skill.skillId,
      ),
      goals: snapshot.goals,
      startLevel: snapshot.overallLevel.level,
      targetLevel: level,
      targetDate: profile.targetDate,
      availabilityMinutes: profile.availabilityMinutes,
      now: new Date(),
    });

    // Reforço de checkpoint (`addReinforcement`) não é reconstruído — só
    // acrescenta. Um rebuild completo junta o que o learner-model acabou de
    // recalcular com o que já estava lá.
    const reinforceSkillIds = [
      ...new Set([
        ...(existing?.reinforceSkillIds ?? []),
        ...result.reinforceSkillIds,
      ]),
    ];

    const data = {
      targetLevel: level,
      targetDate: profile.targetDate,
      path: result.path as unknown as Prisma.InputJsonValue,
      reinforceSkillIds,
      forecast: result.forecast as unknown as Prisma.InputJsonValue,
      version: (existing?.version ?? 0) + 1,
    };

    return this.prisma.studyPlan.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
