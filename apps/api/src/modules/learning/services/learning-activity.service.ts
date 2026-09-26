import { Injectable } from '@nestjs/common';
import type { Competency } from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';

export type UserLearningActivity = {
  userId: string;
  stepTimeMs: number;
  /** Tempo de resposta das questões fora de lição (revisão, material, prova). */
  practiceAnswerMs: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  answers: number;
  firstTryAnswers: number;
  firstTryCorrect: number;
  /** Primeiras tentativas pela competência da skill principal do item. */
  byCompetency: Partial<
    Record<Competency, { answered: number; correct: number }>
  >;
};

export type LessonActivity = {
  lessonId: string;
  started: number;
  completed: number;
  firstTryAnswers: number;
  firstTryCorrect: number;
};

export type StalledAttemptRow = {
  lessonId: string;
  stepIndex: number;
  stepType: string | null;
};

/**
 * Agregados do que o aluno fez, em lote, para o progresso (14). O learning
 * é dono das tentativas, etapas e respostas; quem precisa de números lê
 * daqui, nunca das tabelas.
 *
 * Todo intervalo é `[from, to)` em instantes UTC — quem converte dia local
 * em instante é quem chama.
 */
@Injectable()
export class LearningActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async activityByUser(
    userIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<UserLearningActivity[]> {
    if (userIds.length === 0) {
      return [];
    }

    const ids = [...userIds];
    const [steps, started, completed, answers, competencies] =
      await Promise.all([
        this.prisma.$queryRaw<{ user_id: string; ms: bigint }[]>`
          SELECT a.user_id, SUM(sp.time_spent_ms)::bigint AS ms
          FROM step_progress sp
          JOIN lesson_attempts a ON a.id = sp.attempt_id
          WHERE a.user_id = ANY(${ids}::uuid[])
            AND sp.completed_at >= ${from} AND sp.completed_at < ${to}
          GROUP BY a.user_id`,
        this.prisma.lessonAttempt.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, startedAt: { gte: from, lt: to } },
          _count: { _all: true },
        }),
        this.prisma.lessonAttempt.groupBy({
          by: ['userId'],
          where: {
            userId: { in: ids },
            status: 'COMPLETED',
            completedAt: { gte: from, lt: to },
          },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<
          {
            user_id: string;
            answers: bigint;
            first_try: bigint;
            first_try_correct: bigint;
            practice_ms: bigint;
          }[]
        >`
          SELECT user_id,
            COUNT(*)::bigint AS answers,
            COUNT(*) FILTER (WHERE is_first_try)::bigint AS first_try,
            COUNT(*) FILTER (WHERE is_first_try AND is_correct)::bigint AS first_try_correct,
            COALESCE(SUM(response_time_ms) FILTER (WHERE context <> 'lesson'), 0)::bigint AS practice_ms
          FROM answers
          WHERE user_id = ANY(${ids}::uuid[])
            AND created_at >= ${from} AND created_at < ${to}
          GROUP BY user_id`,
        this.prisma.$queryRaw<
          {
            user_id: string;
            competency: string;
            answered: bigint;
            correct: bigint;
          }[]
        >`
          SELECT a.user_id, s.competency,
            COUNT(*)::bigint AS answered,
            COUNT(*) FILTER (WHERE a.is_correct)::bigint AS correct
          FROM answers a
          JOIN item_skills isk ON isk.item_id = a.item_id AND isk.position = 0
          JOIN skills s ON s.id = isk.skill_id
          WHERE a.user_id = ANY(${ids}::uuid[])
            AND a.is_first_try
            AND a.created_at >= ${from} AND a.created_at < ${to}
          GROUP BY a.user_id, s.competency`,
      ]);

    const rows = new Map<string, UserLearningActivity>();
    const row = (userId: string): UserLearningActivity => {
      const existing = rows.get(userId);
      if (existing !== undefined) return existing;

      const created: UserLearningActivity = {
        userId,
        stepTimeMs: 0,
        practiceAnswerMs: 0,
        lessonsStarted: 0,
        lessonsCompleted: 0,
        answers: 0,
        firstTryAnswers: 0,
        firstTryCorrect: 0,
        byCompetency: {},
      };
      rows.set(userId, created);
      return created;
    };

    for (const step of steps) {
      row(step.user_id).stepTimeMs = Number(step.ms);
    }
    for (const attempt of started) {
      row(attempt.userId).lessonsStarted = attempt._count._all;
    }
    for (const attempt of completed) {
      row(attempt.userId).lessonsCompleted = attempt._count._all;
    }
    for (const answer of answers) {
      const target = row(answer.user_id);
      target.answers = Number(answer.answers);
      target.firstTryAnswers = Number(answer.first_try);
      target.firstTryCorrect = Number(answer.first_try_correct);
      target.practiceAnswerMs = Number(answer.practice_ms);
    }
    for (const tally of competencies) {
      // SQL cru devolve o valor do enum no banco (`grammar`), não o do Prisma.
      const competency = tally.competency.toUpperCase() as Competency;
      row(tally.user_id).byCompetency[competency] = {
        answered: Number(tally.answered),
        correct: Number(tally.correct),
      };
    }

    return [...rows.values()];
  }

  /** Começos, conclusões e acerto de primeira de cada lição no intervalo. */
  async lessonActivity(from: Date, to: Date): Promise<LessonActivity[]> {
    const [started, completed, answers] = await Promise.all([
      this.prisma.lessonAttempt.groupBy({
        by: ['lessonId'],
        where: { startedAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
      this.prisma.lessonAttempt.groupBy({
        by: ['lessonId'],
        where: { status: 'COMPLETED', completedAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        { lesson_id: string; first_try: bigint; correct: bigint }[]
      >`
        SELECT la.lesson_id,
          COUNT(*)::bigint AS first_try,
          COUNT(*) FILTER (WHERE a.is_correct)::bigint AS correct
        FROM answers a
        JOIN lesson_attempts la ON la.id = a.attempt_id
        WHERE a.context = 'lesson' AND a.is_first_try
          AND a.created_at >= ${from} AND a.created_at < ${to}
        GROUP BY la.lesson_id`,
    ]);

    const rows = new Map<string, LessonActivity>();
    const row = (lessonId: string): LessonActivity => {
      const existing = rows.get(lessonId);
      if (existing !== undefined) return existing;

      const created = {
        lessonId,
        started: 0,
        completed: 0,
        firstTryAnswers: 0,
        firstTryCorrect: 0,
      };
      rows.set(lessonId, created);
      return created;
    };

    for (const attempt of started) {
      row(attempt.lessonId).started = attempt._count._all;
    }
    for (const attempt of completed) {
      row(attempt.lessonId).completed = attempt._count._all;
    }
    for (const answer of answers) {
      row(answer.lesson_id).firstTryAnswers = Number(answer.first_try);
      row(answer.lesson_id).firstTryCorrect = Number(answer.correct);
    }

    return [...rows.values()];
  }

  /**
   * Tentativas ainda abertas cuja **última atividade** (início, etapa ou
   * resposta) caiu em `[from, to)`. Quem chama passa o intervalo deslocado
   * pelo prazo de abandono — cada tentativa parada é contada uma vez só, no
   * dia em que completa o prazo. Se o aluno voltar depois, a última
   * atividade muda e ela sai desta janela.
   */
  async stalledAttempts(from: Date, to: Date): Promise<StalledAttemptRow[]> {
    const rows = await this.prisma.$queryRaw<
      {
        lesson_id: string;
        lesson_version_id: string;
        current_step_index: number;
      }[]
    >`
      SELECT la.lesson_id, la.lesson_version_id, la.current_step_index
      FROM lesson_attempts la
      WHERE la.status = 'in_progress'
        AND GREATEST(
          la.started_at,
          COALESCE((SELECT MAX(sp.completed_at) FROM step_progress sp WHERE sp.attempt_id = la.id), la.started_at),
          COALESCE((SELECT MAX(a.created_at) FROM answers a WHERE a.attempt_id = la.id), la.started_at)
        ) >= ${from}
        AND GREATEST(
          la.started_at,
          COALESCE((SELECT MAX(sp.completed_at) FROM step_progress sp WHERE sp.attempt_id = la.id), la.started_at),
          COALESCE((SELECT MAX(a.created_at) FROM answers a WHERE a.attempt_id = la.id), la.started_at)
        ) < ${to}`;

    const versionIds = [...new Set(rows.map((row) => row.lesson_version_id))];
    const stepTypes = new Map<string, string[]>();

    for (const versionId of versionIds) {
      try {
        const outline = await this.catalog.findVersionOutline(versionId);
        stepTypes.set(
          versionId,
          outline.steps.map((step) => step.type),
        );
      } catch {
        // Versão apagada: a etapa fica sem tipo, o abandono ainda conta.
      }
    }

    return rows.map((row) => ({
      lessonId: row.lesson_id,
      stepIndex: row.current_step_index,
      stepType:
        stepTypes.get(row.lesson_version_id)?.[row.current_step_index] ?? null,
    }));
  }

  /** Lições que o aluno já concluiu ao menos uma vez. */
  async completedLessonIds(
    userId: string,
    lessonIds: readonly string[],
  ): Promise<Set<string>> {
    if (lessonIds.length === 0) {
      return new Set();
    }

    const rows = await this.prisma.lessonAttempt.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        lessonId: { in: [...lessonIds] },
      },
      distinct: ['lessonId'],
      select: { lessonId: true },
    });

    return new Set(rows.map((row) => row.lessonId));
  }
}
