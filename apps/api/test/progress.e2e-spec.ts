import { getQueueToken } from '@nestjs/bullmq';
import { Role, type Competency } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import { EntitlementsService } from 'src/modules/billing/services/entitlements.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';
import {
  addDays,
  localDateOf,
  weekStart,
} from 'src/modules/progress/domain/dates';
import { AggregationService } from 'src/modules/progress/services/aggregation.service';
import { QUEUES } from 'src/infra/queue/queues';

import { billingSeed } from '../prisma/seeds/billing.seed';
import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';
const TZ = 'America/Sao_Paulo';
/** Uma quinta-feira no passado: dia fixo, sem depender do relógio. */
const DAY = '2026-09-10';
const at = (iso: string) => new Date(iso);
const dbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

/**
 * Módulo 14. As linhas-fonte (tentativa, etapa, resposta, revisão, uso de
 * IA) entram direto no banco com horário escolhido — é o que deixa provar
 * o dia local, a idempotência e o abandono sem esperar dias de verdade. A
 * agregação roda de verdade, pelo mesmo serviço do job noturno.
 */
describe('Progress (e2e)', () => {
  let context: TestApp;
  let aggregation: AggregationService;
  let entitlements: EntitlementsService;
  let profiles: LearnerProfileService;
  let progressQueue: Queue;

  beforeAll(async () => {
    context = await createTestApp();
    aggregation = context.app.get(AggregationService);
    entitlements = context.app.get(EntitlementsService);
    profiles = context.app.get(LearnerProfileService);
    progressQueue = context.app.get<Queue>(getQueueToken(QUEUES.PROGRESS));
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.resetRateLimit();
    await curriculumSeed.run(context.prisma);
    await billingSeed.run(context.prisma);
  });

  afterAll(async () => {
    await progressQueue.obliterate({ force: true });
    await context.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function student(
    email: string,
    options: {
      createdAt?: Date;
      availability?: Record<string, number>;
    } = {},
  ) {
    const signup = await http()
      .post('/auth/signup')
      .send({
        name: 'Aluno',
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);
    const userId = signup.body.user.id as string;

    await context.prisma.user.update({
      where: { id: userId },
      data: { createdAt: options.createdAt ?? at('2026-08-01T12:00:00Z') },
    });
    await context.prisma.studentProfile.upsert({
      where: { userId },
      create: {
        userId,
        timezone: TZ,
        availabilityMinutes: options.availability ?? {},
      },
      update: {
        timezone: TZ,
        availabilityMinutes: options.availability ?? {},
      },
    });

    return {
      userId,
      auth: { Authorization: `Bearer ${signup.body.accessToken as string}` },
    };
  }

  async function admin() {
    const { userId } = await student('admin@exemplo.com');
    await context.prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });
    const signin = await http()
      .post('/auth/signin')
      .send({ email: 'admin@exemplo.com', password: PASSWORD })
      .expect(200);

    return { Authorization: `Bearer ${signin.body.accessToken as string}` };
  }

  async function makePlus(userId: string, createdAt: Date) {
    const plan = await context.prisma.subscriptionPlan.findFirstOrThrow({
      where: { tier: 'PLUS', billingPeriod: 'MONTHLY' },
    });
    await context.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        tier: 'PLUS',
        billingPeriod: 'MONTHLY',
        priceCents: plan.priceCents,
        paymentMethod: 'PIX',
        status: 'ACTIVE',
        currentPeriodEnd: at('2030-01-01T00:00:00Z'),
        createdAt,
      },
    });
    await entitlements.invalidate(userId);
    return plan.priceCents;
  }

  async function seedLesson() {
    const lesson = await context.prisma.lesson.findFirstOrThrow({
      where: { publishedVersionId: { not: null } },
      include: {
        publishedVersion: {
          include: {
            steps: { orderBy: { order: 'asc' } },
            targetSkills: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    const version = lesson.publishedVersion;
    if (version === null) throw new Error('lição seed sem versão publicada');

    return {
      lessonId: lesson.id,
      slug: lesson.slug,
      versionId: version.id,
      version: version.version,
      stepTypes: version.steps.map((step) => step.type),
      targetSkillIds: version.targetSkills.map((target) => target.skillId),
    };
  }

  async function itemBySlug(slug: string) {
    const item = await context.prisma.item.findUniqueOrThrow({
      where: { slug },
      include: { skills: { where: { position: 0 }, include: { skill: true } } },
    });
    return {
      id: item.id,
      competency: item.skills[0]?.skill.competency as Competency,
    };
  }

  type AnswerSeed = {
    itemId: string;
    attemptId?: string | null;
    context?: 'LESSON' | 'REVIEW';
    isCorrect: boolean;
    isFirstTry?: boolean;
    responseTimeMs?: number;
    createdAt: Date;
  };

  async function answer(userId: string, seed: AnswerSeed) {
    await context.prisma.answer.create({
      data: {
        userId,
        itemId: seed.itemId,
        attemptId: seed.attemptId ?? null,
        context: seed.context ?? 'LESSON',
        response: {},
        isCorrect: seed.isCorrect,
        score: seed.isCorrect ? 1 : 0,
        responseTimeMs: seed.responseTimeMs ?? 5_000,
        detectedErrorPatterns: [],
        isFirstTry: seed.isFirstTry ?? true,
        createdAt: seed.createdAt,
      },
    });
  }

  async function aiUsage(
    userId: string | null,
    feature: string,
    costUsdMicros: number,
    createdAt: Date,
  ) {
    await context.prisma.aiUsage.create({
      data: {
        userId,
        feature,
        promptId: feature,
        promptVersion: 1,
        model: 'fake',
        tier: 'FAST',
        inputTokens: 100,
        outputTokens: 50,
        costUsdMicros,
        latencyMs: 10,
        status: 'OK',
        createdAt,
      },
    });
  }

  /**
   * Um dia típico do aluno em DAY (São Paulo, UTC−3): lição com duas
   * etapas e respostas, uma revisão de questão e duas de flashcard, uma
   * chamada de IA — mais uma resposta às 23h30 locais (já é outro dia no
   * UTC) e uma às 23h30 da véspera (já é DAY no UTC, mas não lá).
   */
  async function seedStudyDay(userId: string) {
    const lesson = await seedLesson();
    const maya = await itemBySlug('a1-be-i-am-maya');
    const age = await itemBySlug('a1-type-im-20-years-old');

    const attempt = await context.prisma.lessonAttempt.create({
      data: {
        userId,
        lessonId: lesson.lessonId,
        lessonVersionId: lesson.versionId,
        versionNumber: lesson.version,
        status: 'COMPLETED',
        currentStepIndex: lesson.stepTypes.length,
        startedAt: at(`${DAY}T12:00:00Z`),
        completedAt: at(`${DAY}T12:20:00Z`),
      },
    });
    await context.prisma.stepProgress.createMany({
      data: [
        {
          attemptId: attempt.id,
          stepIndex: 0,
          type: lesson.stepTypes[0] ?? 'SCENE',
          timeSpentMs: 300_000,
          completedAt: at(`${DAY}T12:05:00Z`),
        },
        {
          attemptId: attempt.id,
          stepIndex: 1,
          type: lesson.stepTypes[1] ?? 'SCENE',
          timeSpentMs: 240_000,
          completedAt: at(`${DAY}T12:10:00Z`),
        },
      ],
    });

    await answer(userId, {
      itemId: maya.id,
      attemptId: attempt.id,
      isCorrect: true,
      createdAt: at(`${DAY}T12:11:00Z`),
    });
    await answer(userId, {
      itemId: age.id,
      attemptId: attempt.id,
      isCorrect: false,
      createdAt: at(`${DAY}T12:12:00Z`),
    });
    // Refazer depois do gabarito: conta como resposta, não como 1ª tentativa.
    await answer(userId, {
      itemId: age.id,
      attemptId: attempt.id,
      isCorrect: true,
      isFirstTry: false,
      createdAt: at(`${DAY}T12:13:00Z`),
    });
    // Revisão de SKILL: tempo de resposta conta como prática.
    await answer(userId, {
      itemId: maya.id,
      context: 'REVIEW',
      isCorrect: true,
      responseTimeMs: 20_000,
      createdAt: at(`${DAY}T13:00:00Z`),
    });
    // 23h30 em São Paulo: ainda é DAY lá.
    await answer(userId, {
      itemId: maya.id,
      context: 'REVIEW',
      isCorrect: false,
      responseTimeMs: 10_000,
      createdAt: at(`${addDays(DAY, 1)}T02:30:00Z`),
    });
    // 23h30 da véspera em São Paulo: fica fora de DAY.
    await answer(userId, {
      itemId: maya.id,
      context: 'REVIEW',
      isCorrect: true,
      responseTimeMs: 99_000,
      createdAt: at(`${DAY}T02:30:00Z`),
    });

    const card = await context.prisma.reviewCard.create({
      data: {
        userId,
        kind: 'VOCAB',
        refId: 'vocab.numbers-1-20',
        source: 'LESSON',
        due: at(`${DAY}T00:00:00Z`),
        stability: 1,
        difficulty: 5,
      },
    });
    await context.prisma.reviewLog.createMany({
      data: [
        {
          userId,
          cardId: card.id,
          kind: 'SKILL',
          rating: 'GOOD',
          reviewedAt: at(`${DAY}T13:00:00Z`),
        },
        {
          userId,
          cardId: card.id,
          kind: 'VOCAB',
          rating: 'GOOD',
          reviewedAt: at(`${DAY}T13:01:00Z`),
        },
        {
          userId,
          cardId: card.id,
          kind: 'VOCAB',
          rating: 'HARD',
          reviewedAt: at(`${DAY}T13:02:00Z`),
        },
      ],
    });

    await aiUsage(userId, 'tutor-correction', 3_000, at(`${DAY}T15:00:00Z`));

    return { lesson, maya, age };
  }

  it('agrega o dia do aluno no fuso dele, e reprocessar não duplica', async () => {
    const ana = await student('ana@exemplo.com', {
      availability: { thu: 30 },
    });
    // Sem nada no dia e sem disponibilidade: não ganha linha.
    await student('bia@exemplo.com');
    const { maya, age } = await seedStudyDay(ana.userId);

    await aggregation.aggregateDay(DAY);
    await aggregation.aggregateDay(DAY);

    const rows = await context.prisma.userDailyActivity.findMany({
      where: { date: dbDate(DAY) },
    });
    expect(rows.map((row) => row.userId)).toEqual([ana.userId]);

    const row = rows[0];
    expect(row).toMatchObject({
      lessonSeconds: 540,
      // 20 s da revisão + 10 s da resposta das 23h30 locais.
      practiceSeconds: 30,
      reviewSeconds: 2 * 25,
      studySeconds: 620,
      lessonsStarted: 1,
      lessonsCompleted: 1,
      answers: 5,
      firstTryAnswers: 4,
      firstTryCorrect: 2,
      reviewsDone: 3,
      plannedMinutes: 30,
      aiCalls: 1,
      aiCostUsdMicros: 3_000,
      tier: 'FREE',
      active: true,
    });

    const expected: Record<string, { answered: number; correct: number }> = {};
    for (const [competency, correct] of [
      [maya.competency, 1],
      [age.competency, 0],
      [maya.competency, 1],
      [maya.competency, 0],
    ] as const) {
      const current = expected[competency] ?? { answered: 0, correct: 0 };
      expected[competency] = {
        answered: current.answered + 1,
        correct: current.correct + correct,
      };
    }
    expect(row?.byCompetency).toEqual(expected);

    // O mesmo dia no UTC teria contado a resposta da véspera.
    const platform = await context.prisma.dailyPlatformMetric.findUniqueOrThrow(
      {
        where: { date: dbDate(DAY) },
      },
    );
    expect(platform).toMatchObject({ dau: 1, wau: 1, mau: 1 });
  });

  it('conta abandono na etapa em que o aluno parou, uma vez só', async () => {
    const ana = await student('ana@exemplo.com');
    const lesson = await seedLesson();
    const stalledDay = addDays(DAY, -7);

    const attempt = await context.prisma.lessonAttempt.create({
      data: {
        userId: ana.userId,
        lessonId: lesson.lessonId,
        lessonVersionId: lesson.versionId,
        versionNumber: lesson.version,
        currentStepIndex: 1,
        startedAt: at(`${stalledDay}T12:00:00Z`),
      },
    });
    await context.prisma.stepProgress.create({
      data: {
        attemptId: attempt.id,
        stepIndex: 0,
        type: lesson.stepTypes[0] ?? 'SCENE',
        timeSpentMs: 60_000,
        completedAt: at(`${stalledDay}T12:03:00Z`),
      },
    });

    await aggregation.aggregateDay(stalledDay);
    await aggregation.aggregateDay(DAY);
    await aggregation.aggregateDay(addDays(DAY, 1));

    const metrics = await context.prisma.lessonDailyMetric.findMany({
      where: { lessonId: lesson.lessonId },
      orderBy: { date: 'asc' },
    });
    const byDate = new Map(
      metrics.map((row) => [row.date.toISOString().slice(0, 10), row]),
    );

    expect(byDate.get(stalledDay)).toMatchObject({ started: 1, abandoned: 0 });
    expect(byDate.get(DAY)).toMatchObject({
      abandoned: 1,
      abandonedByStep: [
        { stepIndex: 1, stepType: lesson.stepTypes[1] ?? null, count: 1 },
      ],
    });
    // Parada há 8 dias: já foi contada ontem.
    expect(byDate.get(addDays(DAY, 1))).toBeUndefined();
  });

  it('mostra atividade, coorte, lições, custo de IA e receita ao admin', async () => {
    const adminAuth = await admin();
    const ana = await student('ana@exemplo.com', {
      createdAt: at('2026-09-08T12:00:00Z'),
    });
    const leo = await student('leo@exemplo.com', {
      createdAt: at('2026-09-09T12:00:00Z'),
    });
    const priceCents = await makePlus(leo.userId, at('2026-09-09T12:00:00Z'));

    await seedStudyDay(ana.userId);
    await aiUsage(
      leo.userId,
      'generator-material',
      50_000,
      at(`${DAY}T16:00:00Z`),
    );
    await aiUsage(
      leo.userId,
      'generator-exercises',
      5_000,
      at(`${DAY}T16:01:00Z`),
    );
    await aiUsage(null, 'content-draft', 1_000, at(`${DAY}T16:02:00Z`));

    await aggregation.aggregateRange(DAY, DAY);

    await http().get('/admin/metrics').set(ana.auth).expect(403);
    await http()
      .get('/admin/metrics')
      .query({ from: DAY, to: addDays(DAY, -1) })
      .set(adminAuth)
      .expect(400);

    const res = await http()
      .get('/admin/metrics')
      .query({ from: DAY, to: DAY })
      .set(adminAuth)
      .expect(200);
    const body = res.body;

    expect(body.activity).toMatchObject({ dau: 2, wau: 2, mau: 2 });
    expect(body.activity.daily[0]).toMatchObject({
      date: DAY,
      // ana e leo — o admin foi criado em 2026-08-01.
      newUsers: 0,
      lessonsStarted: 1,
      lessonsCompleted: 1,
    });

    // Ana e Leo entraram na semana de 07/09; o admin, bem antes.
    const cohort = body.retention.find(
      (row: { cohortWeek: string }) => row.cohortWeek === '2026-09-07',
    );
    expect(cohort).toMatchObject({ size: 2 });
    expect(cohort.weeks[0]).toMatchObject({ offset: 0, retained: 2, rate: 1 });

    expect(body.lessons).toMatchObject({
      started: 1,
      completed: 1,
      completionRate: 1,
    });
    expect(body.lessons.byLesson[0].title).toEqual(expect.any(String));

    const features = Object.fromEntries(
      body.aiCost.byFeature.map(
        (row: { feature: string; costUsdMicros: number }) => [
          row.feature,
          row.costUsdMicros,
        ],
      ),
    );
    expect(features).toEqual({
      'generator-material': 50_000,
      'generator-exercises': 5_000,
      'tutor-correction': 3_000,
      'content-draft': 1_000,
    });
    const tiers = Object.fromEntries(
      body.aiCost.byTier.map((row: { tier: string; costUsdMicros: number }) => [
        row.tier,
        row.costUsdMicros,
      ]),
    );
    expect(tiers).toEqual({ PLUS: 55_000, FREE: 3_000, SYSTEM: 1_000 });
    expect(
      body.aiCost.topUsers.map((row: { email: string }) => row.email),
    ).toEqual(['leo@exemplo.com', 'ana@exemplo.com']);

    const plus = body.revenue.byTier.find(
      (row: { tier: string }) => row.tier === 'PLUS',
    );
    expect(plus).toMatchObject({
      subscribers: 1,
      mrrCents: priceCents,
      activeUsers: 1,
      revenueCents: Math.round((priceCents * 12) / 365),
      aiCostUsdMicros: 55_000,
      aiCostBrlCents: Math.round(0.055 * body.revenue.usdBrlRate * 100),
    });
    expect(plus.marginCents).toBe(plus.revenueCents - plus.aiCostBrlCents);
  });

  it('lista os itens problemáticos da calibração', async () => {
    const adminAuth = await admin();
    const maya = await itemBySlug('a1-be-i-am-maya');
    await context.prisma.itemCalibration.create({
      data: {
        itemId: maya.id,
        responses: 40,
        pValue: 0.97,
        estimatedDifficulty: -3.2,
        previousDifficulty: -2,
        appliedDifficulty: -2.5,
        flags: ['TOO_EASY'],
        calibratedAt: at(`${DAY}T06:00:00Z`),
      },
    });

    const res = await http().get('/admin/metrics').set(adminAuth).expect(200);

    expect(res.body.items).toEqual([
      expect.objectContaining({ itemId: maya.id, flags: ['TOO_EASY'] }),
    ]);
  });

  it('reprocessa um intervalo pela fila', async () => {
    const adminAuth = await admin();
    const ana = await student('ana@exemplo.com');
    await seedStudyDay(ana.userId);

    await http()
      .post('/admin/metrics/rebuild')
      .set(adminAuth)
      .send({ from: addDays(DAY, -1), to: DAY })
      .expect(202);

    const deadline = Date.now() + 15_000;
    let row = null;
    while (row === null && Date.now() < deadline) {
      row = await context.prisma.dailyPlatformMetric.findUnique({
        where: { date: dbDate(DAY) },
      });
      if (row === null)
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(row).toMatchObject({ dau: 1 });
  });

  describe('GET /me/progress', () => {
    const now = new Date();
    const today = localDateOf(now, TZ);
    const thisWeek = weekStart(today);
    const lastWeek = addDays(thisWeek, -7);
    const twoWeeksAgo = addDays(thisWeek, -14);
    const everyDay = {
      mon: 30,
      tue: 30,
      wed: 30,
      thu: 30,
      fri: 30,
      sat: 30,
      sun: 30,
    };

    async function setup(email = 'ana@exemplo.com') {
      const ana = await student(email, {
        availability: everyDay,
        createdAt: at(`${twoWeeksAgo}T12:00:00Z`),
      });
      const lesson = await seedLesson();
      const weakSkill = lesson.targetSkillIds[0] ?? '';

      // Duas semanas completas, 15 minutos por dia: metade do planejado.
      await context.prisma.userDailyActivity.createMany({
        data: [twoWeeksAgo, lastWeek].flatMap((week) =>
          Array.from({ length: 7 }, (_, index) => ({
            userId: ana.userId,
            date: dbDate(addDays(week, index)),
            studySeconds: 900,
            lessonSeconds: 900,
            plannedMinutes: 30,
            reviewsDone: 1,
            firstTryAnswers: 2,
            firstTryCorrect: 1,
            byCompetency: { GRAMMAR: { answered: 2, correct: 1 } },
            active: true,
          })),
        ),
      });

      await context.prisma.learnerLevelSnapshot.createMany({
        data: [
          {
            userId: ana.userId,
            weekStart: dbDate(twoWeeksAgo),
            overallLevel: 'A1',
            levels: { GRAMMAR: { level: 'A1' } },
          },
          {
            userId: ana.userId,
            weekStart: dbDate(lastWeek),
            overallLevel: 'A2',
            levels: { GRAMMAR: { level: 'A2' } },
          },
        ],
      });

      await context.prisma.learnerSkillState.create({
        data: {
          userId: ana.userId,
          skillId: weakSkill,
          theta: -4,
          evidenceCount: 10,
          lastPracticedAt: now,
        },
      });
      await context.prisma.learnerErrorPattern.create({
        data: {
          userId: ana.userId,
          errorPatternId: 'l1.have-for-age',
          recentOutcomes: [true, true, true, false, false, false, false, false],
          totalOccurrences: 3,
          lastOccurredAt: now,
        },
      });
      await profiles.invalidate(ana.userId);

      await context.prisma.studyPlan.create({
        data: {
          userId: ana.userId,
          targetLevel: 'B1',
          path: [],
          reinforceSkillIds: [],
          forecast: {
            estimatedArrival: addDays(today, 84),
            weeksNeeded: 12,
            realistic: true,
            message: null,
          },
        },
      });

      return { ...ana, lesson, weakSkill };
    }

    it('monta o painel com evolução, estatísticas, cronograma e previsão', async () => {
      const ana = await setup();

      // Hoje, antes de o job rodar: a lição concluída agora já aparece.
      await context.prisma.lessonAttempt.create({
        data: {
          userId: ana.userId,
          lessonId: ana.lesson.lessonId,
          lessonVersionId: ana.lesson.versionId,
          versionNumber: ana.lesson.version,
          status: 'COMPLETED',
          currentStepIndex: ana.lesson.stepTypes.length,
          startedAt: new Date(now.getTime() - 60_000),
          completedAt: now,
        },
      });

      const res = await http()
        .get('/me/progress')
        .query({ weeks: 4 })
        .set(ana.auth)
        .expect(200);
      const body = res.body;

      expect(body.period).toMatchObject({ to: today, weeks: 4 });
      expect(
        body.level.weekly.map(
          (week: { overallLevel: string | null }) => week.overallLevel,
        ),
      ).toEqual([null, 'A1', 'A2', 'A2']);
      expect(body.level.competencies).toHaveLength(6);
      expect(body.level.competencies[0]).toMatchObject({
        confidence: expect.any(String),
        confidenceLevel: expect.stringMatching(/^(LOW|MEDIUM|HIGH)$/),
      });

      expect(body.stats).toMatchObject({
        minutesStudied: 14 * 15,
        lessonsCompleted: 1,
        reviewsDone: 14,
      });
      expect(
        body.stats.accuracyByCompetency.find(
          (row: { competency: string }) => row.competency === 'GRAMMAR',
        ),
      ).toMatchObject({ answered: 28, correct: 14, rate: 0.5 });
      expect(body.stats.topErrors[0]).toMatchObject({
        errorPatternId: 'l1.have-for-age',
        recentOccurrences: 3,
        trend: 'DECREASING',
        trendLabel: 'Está diminuindo',
      });

      const weeks = new Map(
        body.plan.weeks.map((week: { weekStart: string }) => [
          week.weekStart,
          week,
        ]),
      );
      expect(weeks.get(lastWeek)).toEqual({
        weekStart: lastWeek,
        plannedMinutes: 210,
        studiedMinutes: 105,
        ratio: 0.5,
      });

      // Metade do ritmo planejado: o que falta leva o dobro.
      expect(body.forecast).toMatchObject({
        status: 'BEHIND',
        byPlan: addDays(today, 84),
        byPace: addDays(today, 168),
        weeksDifference: 12,
        targetLevel: 'B1',
      });

      // A lição da skill fraca já foi feita hoje; sem card, sem Plus: refazer.
      const weakness = body.weaknesses.find(
        (row: { skillId: string }) => row.skillId === ana.weakSkill,
      );
      expect(weakness.text).toContain('Vale reforçar');
      expect(weakness.action).toMatchObject({
        type: 'LESSON',
        refId: ana.lesson.lessonId,
        // O slug é o que a rota `/licoes/:slug` do front recebe.
        lessonSlug: ana.lesson.slug,
      });
      expect(weakness.action.label).toContain('Refaça');
    });

    it('sugere a lição, depois a revisão, depois o material do Plus', async () => {
      const ana = await setup();
      const actionFor = async () => {
        const res = await http().get('/me/progress').set(ana.auth).expect(200);
        return res.body.weaknesses.find(
          (row: { skillId: string }) => row.skillId === ana.weakSkill,
        ).action;
      };

      expect(await actionFor()).toMatchObject({
        type: 'LESSON',
        refId: ana.lesson.lessonId,
        lessonSlug: ana.lesson.slug,
      });

      await context.prisma.lessonAttempt.create({
        data: {
          userId: ana.userId,
          lessonId: ana.lesson.lessonId,
          lessonVersionId: ana.lesson.versionId,
          versionNumber: ana.lesson.version,
          status: 'COMPLETED',
          currentStepIndex: ana.lesson.stepTypes.length,
          startedAt: at(`${lastWeek}T12:00:00Z`),
          completedAt: at(`${lastWeek}T12:30:00Z`),
        },
      });
      await makePlus(ana.userId, at(`${lastWeek}T12:00:00Z`));
      expect(await actionFor()).toMatchObject({
        type: 'MATERIAL',
        refId: ana.weakSkill,
      });

      const card = await context.prisma.reviewCard.create({
        data: {
          userId: ana.userId,
          kind: 'SKILL',
          refId: ana.weakSkill,
          source: 'LESSON',
          due: now,
          stability: 1,
          difficulty: 5,
        },
      });
      expect(await actionFor()).toMatchObject({
        type: 'REVIEW',
        refId: card.id,
      });
    });

    it('recusa semanas fora do intervalo', async () => {
      const ana = await student('ana@exemplo.com');
      await http()
        .get('/me/progress')
        .query({ weeks: 2 })
        .set(ana.auth)
        .expect(400);
    });
  });
});
