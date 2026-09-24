import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContentStatus, LessonAttemptStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

/**
 * Módulo 6: o aluno faz a lição "Nice to meet you" do seed inteira pela API.
 *
 * O seed roda de verdade contra o banco de teste — é a lição que o produto
 * entrega, com as sete questões da prática nos tipos reais. Os eventos são
 * capturados direto no EventEmitter2, e o worker da fila `learning` está de
 * pé, então a estatística dos itens é conferida esperando o job.
 */
describe('Learning (e2e)', () => {
  let context: TestApp;
  let learningQueue: Queue;
  let emitter: EventEmitter2;
  let events: DomainEvent[] = [];

  const capture = (name: string | string[], event: unknown) => {
    if (typeof name === 'string' && /^(lesson|answer)\./.test(name)) {
      events.push(event as DomainEvent);
    }
  };

  beforeAll(async () => {
    context = await createTestApp();
    learningQueue = context.app.get<Queue>(getQueueToken(QUEUES.LEARNING));
    emitter = context.app.get(EventEmitter2);
    emitter.onAny(capture);
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.resetRateLimit();
    await curriculumSeed.run(context.prisma);
    events = [];
  });

  afterAll(async () => {
    emitter?.offAny(capture);
    await learningQueue?.obliterate({ force: true });
    await context?.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function studentToken(email = 'aluno@exemplo.com'): Promise<string> {
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

    return signup.body.accessToken as string;
  }

  async function lessonId(): Promise<string> {
    const lesson = await context.prisma.lesson.findUniqueOrThrow({
      where: { slug: 'nice-to-meet-you' },
      select: { id: true },
    });
    return lesson.id;
  }

  async function itemIds(): Promise<Record<string, string>> {
    const rows = await context.prisma.item.findMany({
      where: { slug: { not: null } },
      select: { id: true, slug: true },
    });
    return Object.fromEntries(rows.map((row) => [row.slug ?? '', row.id]));
  }

  async function waitFor<T>(
    read: () => Promise<T | null>,
    what: string,
    timeoutMs = 20_000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const value = await read();

      if (value !== null) {
        return value;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Esperei ${what} por ${String(timeoutMs)}ms e não veio.`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const named = (name: string) => events.filter((event) => event.name === name);

  // -------------------------------------------------------------------------

  it('completa a lição seed via API, com eventos, respostas e XP', async () => {
    const token = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };
    const id = await lessonId();
    const items = await itemIds();

    // --- começar e retomar ---

    const started = await http()
      .post(`/lessons/${id}/attempts`)
      .set(auth)
      .send({ source: 'PLAN' })
      .expect(201);

    const attemptId = started.body.id as string;

    expect(started.body).toMatchObject({
      resumed: false,
      status: 'IN_PROGRESS',
      source: 'PLAN',
      version: 1,
      totalSteps: 6,
      currentStepIndex: 0,
    });
    expect(
      (started.body.steps as { type: string }[]).map((step) => step.type),
    ).toEqual([
      'SCENE',
      'EXPLANATION_CARDS',
      'PRACTICE',
      'FREE_PRODUCTION',
      'ROLEPLAY',
      'SUMMARY',
    ]);
    expect(started.body.steps[2].itemIds).toHaveLength(7);

    const resumed = await http()
      .post(`/lessons/${id}/attempts`)
      .set(auth)
      .send({})
      .expect(200);

    expect(resumed.body).toMatchObject({ id: attemptId, resumed: true });

    // --- etapas antes da prática ---

    const step = (index: number, body: object = { timeSpentMs: 20_000 }) =>
      http()
        .post(`/attempts/${attemptId}/steps/${String(index)}/complete`)
        .set(auth)
        .send(body);

    await step(0).expect(200);
    const again = await step(0).expect(200);
    expect(again.body.currentStepIndex).toBe(1);
    await step(1).expect(200);

    const earlyPractice = await step(2).expect(422);
    expect(earlyPractice.body.error.code).toBe('PRACTICE_INCOMPLETE');
    expect(earlyPractice.body.error.details.unansweredItemIds).toHaveLength(7);

    const earlyFinish = await http()
      .post(`/attempts/${attemptId}/complete`)
      .set(auth)
      .expect(422);
    expect(earlyFinish.body.error.code).toBe('ATTEMPT_INCOMPLETE');
    expect(earlyFinish.body.error.details.missingSteps).toEqual([2, 3, 4, 5]);

    // --- prática ---

    const answer = (slug: string, response: object) =>
      http().post('/answers').set(auth).send({
        itemId: items[slug],
        attemptId,
        context: 'LESSON',
        response,
        responseTimeMs: 4_000,
      });

    const maya = await answer('a1-be-i-am-maya', { optionIds: ['am'] }).expect(
      201,
    );
    expect(maya.body).toMatchObject({
      isCorrect: true,
      score: 1,
      verdict: 'CORRECT',
      isFirstTry: true,
    });
    expect(maya.body.explanation).toContain('am');

    await answer('a1-listen-hes-friendly', {
      optionIds: ['contracted'],
    }).expect(201);

    // Montagem com duas peças fora do lugar: crédito parcial. Depois refaz.
    const partial = await answer('a1-order-im-from-brazil', {
      tokens: ['from', "I'm", 'Brazil'],
    }).expect(201);
    expect(partial.body).toMatchObject({
      isCorrect: false,
      score: 0.75,
      verdict: 'PARTIAL',
      correctAnswer: { text: "I'm from Brazil" },
    });

    const retry = await answer('a1-order-im-from-brazil', {
      tokens: ["I'm", 'from', 'Brazil'],
    }).expect(201);
    expect(retry.body).toMatchObject({ isCorrect: true, isFirstTry: false });

    await answer('a1-fill-biscuit-is-a-dog', { text: 'is' }).expect(201);
    await answer('a1-reply-nice-to-meet-you', { optionIds: ['too'] }).expect(
      201,
    );
    await answer('a1-order-nice-to-meet-you', {
      tokens: ['Nice', 'to', 'meet', 'you'],
    }).expect(201);

    // Erro típico de brasileiro: sujeito some.
    const missingSubject = await answer('a1-type-shes-from-austin', {
      text: 'She from Austin',
    }).expect(201);
    expect(missingSubject.body.isCorrect).toBe(false);
    expect(missingSubject.body.errorPatterns).toEqual([
      expect.objectContaining({
        id: 'l1.missing-subject',
        description: expect.any(String),
        correction: expect.any(String),
      }),
    ]);

    await answer('a1-type-shes-from-austin', {
      text: 'she is from austin',
    }).expect(201);

    // --- o resto das etapas ---

    await step(2).expect(200);
    await step(3, {
      timeSpentMs: 90_000,
      response: { text: "Hi! I'm Ana. I'm from Recife. Nice to meet you." },
    }).expect(200);
    await step(4).expect(200);
    const last = await step(5).expect(200);
    expect(last.body.currentStepIndex).toBe(6);

    // --- concluir ---

    const done = await http()
      .post(`/attempts/${attemptId}/complete`)
      .set(auth)
      .expect(200);

    // 7 questões de primeira: 5 certas (50) + 0.75 (8) + 1 errada (0) = 58.
    expect(done.body.xp).toEqual({
      fromAnswers: 58,
      completionBonus: 20,
      total: 78,
    });
    expect(done.body.stats).toMatchObject({
      totalXp: 78,
      currentStreak: 1,
      longestStreak: 1,
    });
    expect(done.body.attempt).toMatchObject({
      status: 'COMPLETED',
      xpEarned: 78,
    });

    // Concluir de novo não soma XP.
    const twice = await http()
      .post(`/attempts/${attemptId}/complete`)
      .set(auth)
      .expect(200);
    expect(twice.body.xp.total).toBe(78);
    expect(twice.body.stats.totalXp).toBe(78);

    // --- o que ficou salvo ---

    const saved = await context.prisma.answer.findMany({
      where: { attemptId },
      orderBy: { createdAt: 'asc' },
    });

    expect(saved).toHaveLength(9);
    expect(saved.filter((row) => row.isFirstTry)).toHaveLength(7);
    expect(saved.every((row) => row.context === 'LESSON')).toBe(true);
    expect(saved.every((row) => row.stepIndex === 2)).toBe(true);
    expect(
      saved.find((row) => row.itemId === items['a1-type-shes-from-austin'])
        ?.detectedErrorPatterns,
    ).toEqual(['l1.missing-subject']);

    const production = await context.prisma.stepProgress.findUniqueOrThrow({
      where: { attemptId_stepIndex: { attemptId, stepIndex: 3 } },
    });
    expect(production).toMatchObject({
      type: 'FREE_PRODUCTION',
      timeSpentMs: 90_000,
      response: { text: "Hi! I'm Ana. I'm from Recife. Nice to meet you." },
    });
    expect(
      await context.prisma.stepProgress.count({ where: { attemptId } }),
    ).toBe(6);

    // --- eventos ---

    expect(named('lesson.started')).toHaveLength(1);
    expect(named('lesson.step_completed')).toHaveLength(6);
    expect(named('answer.submitted')).toHaveLength(9);
    expect(named('lesson.completed')).toHaveLength(1);

    const partialEvent = named('answer.submitted').find(
      (event) =>
        (event.payload as { itemId: string }).itemId ===
          items['a1-order-im-from-brazil'] &&
        (event.payload as { isFirstTry: boolean }).isFirstTry,
    );
    expect(partialEvent?.userId).toBeDefined();
    expect(partialEvent?.payload).toMatchObject({
      attemptId,
      context: 'LESSON',
      isCorrect: false,
      score: 0.75,
      errorPatterns: [],
      difficulty: -2,
      skillIds: ['chunk.where-are-you-from', 'grammar.be.present.affirmative'],
    });

    expect(named('lesson.completed')[0]?.payload).toMatchObject({
      attemptId,
      lessonId: id,
      source: 'PLAN',
      xpEarned: 78,
      answeredItems: 7,
      correctFirstTries: 5,
      currentStreak: 1,
    });

    // --- histórico ---

    const history = await http().get('/me/history').set(auth).expect(200);

    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({
      attemptId,
      lessonSlug: 'nice-to-meet-you',
      title: 'Nice to meet you',
      status: 'COMPLETED',
      xpEarned: 78,
    });

    // --- estatística do item, pelo job em lote ---

    const orderItem = await waitFor(async () => {
      const row = await context.prisma.item.findUniqueOrThrow({
        where: { id: items['a1-order-im-from-brazil'] ?? '' },
        select: { exposureCount: true, correctRate: true },
      });
      return row.exposureCount > 0 ? row : null;
    }, 'a estatística do item');

    // Duas respostas, uma exposição: a segunda foi depois de ver o gabarito.
    // E pouca exposição ainda não vira taxa.
    expect(orderItem).toEqual({ exposureCount: 1, correctRate: null });
  });

  it('reenviar a mesma resposta não grava duas vezes', async () => {
    const auth = { Authorization: `Bearer ${await studentToken()}` };
    const items = await itemIds();

    const send = () =>
      http()
        .post('/answers')
        .set(auth)
        .send({
          itemId: items['a1-match-pronoun-be'],
          context: 'REVIEW',
          response: {
            pairs: [
              { left: 'I', right: 'am' },
              { left: 'he', right: 'are' },
              { left: 'they', right: 'is' },
            ],
          },
          responseTimeMs: 6_000,
          clientAnswerId: 'client-answer-0001',
        })
        .expect(201);

    const first = await send();
    const second = await send();

    expect(first.body).toMatchObject({ score: 0.33, verdict: 'PARTIAL' });
    expect(second.body.answerId).toBe(first.body.answerId);
    expect(await context.prisma.answer.count()).toBe(1);
    expect(named('answer.submitted')).toHaveLength(1);
  });

  it('recusa resposta fora de contexto, de formato errado ou em tentativa alheia', async () => {
    const auth = { Authorization: `Bearer ${await studentToken()}` };
    const other = {
      Authorization: `Bearer ${await studentToken('outro@exemplo.com')}`,
    };
    const items = await itemIds();
    const id = await lessonId();

    const attempt = await http()
      .post(`/lessons/${id}/attempts`)
      .set(auth)
      .send({})
      .expect(201);
    const attemptId = attempt.body.id as string;

    // LESSON sem tentativa.
    await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: items['a1-be-i-am-maya'],
        context: 'LESSON',
        response: { optionIds: ['am'] },
        responseTimeMs: 1_000,
      })
      .expect(400);

    // Contexto que só o servidor grava.
    await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: items['a1-be-i-am-maya'],
        context: 'PLACEMENT',
        response: { optionIds: ['am'] },
        responseTimeMs: 1_000,
      })
      .expect(400);

    // Questão do banco que não está nesta lição.
    const outside = await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: items['a1-match-pronoun-be'],
        attemptId,
        context: 'LESSON',
        response: { pairs: [{ left: 'I', right: 'am' }] },
        responseTimeMs: 1_000,
      })
      .expect(422);
    expect(outside.body.error.code).toBe('ITEM_NOT_IN_ATTEMPT');

    // Formato de digitado numa questão de escolha.
    const shape = await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: items['a1-be-i-am-maya'],
        attemptId,
        context: 'LESSON',
        response: { text: 'am' },
        responseTimeMs: 1_000,
      })
      .expect(422);
    expect(shape.body.error.code).toBe('INVALID_ANSWER_RESPONSE');

    // Tentativa de outro aluno: 404, não confirma que existe.
    await http()
      .post('/answers')
      .set(other)
      .send({
        itemId: items['a1-be-i-am-maya'],
        attemptId,
        context: 'LESSON',
        response: { optionIds: ['am'] },
        responseTimeMs: 1_000,
      })
      .expect(404);
    await http()
      .post(`/attempts/${attemptId}/steps/0/complete`)
      .set(other)
      .send({})
      .expect(404);

    // Questão em rascunho não é respondível.
    await context.prisma.item.update({
      where: { id: items['a1-article-a-dog'] ?? '' },
      data: { status: ContentStatus.DRAFT },
    });
    await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: items['a1-article-a-dog'],
        context: 'REVIEW',
        response: { optionIds: ['a'] },
        responseTimeMs: 1_000,
      })
      .expect(404);

    expect(await context.prisma.answer.count()).toBe(0);
  });

  it('lição republicada no meio do caminho: larga a tentativa antiga e começa na nova', async () => {
    const auth = { Authorization: `Bearer ${await studentToken()}` };
    const id = await lessonId();

    const first = await http()
      .post(`/lessons/${id}/attempts`)
      .set(auth)
      .send({})
      .expect(201);

    // Versão 2 no ar, com as mesmas etapas.
    const v1 = await context.prisma.lessonVersion.findFirstOrThrow({
      where: { lessonId: id, version: 1 },
      include: { steps: true },
    });
    const v2 = await context.prisma.lessonVersion.create({
      data: {
        lessonId: id,
        version: 2,
        status: ContentStatus.PUBLISHED,
        title: v1.title,
        objective: v1.objective,
        cefrLevel: v1.cefrLevel,
        publishedAt: new Date(),
        steps: {
          create: v1.steps.map((row) => ({
            order: row.order,
            type: row.type,
            content: row.content ?? {},
          })),
        },
      },
    });
    await context.prisma.lesson.update({
      where: { id },
      data: { publishedVersionId: v2.id },
    });

    const second = await http()
      .post(`/lessons/${id}/attempts`)
      .set(auth)
      .send({})
      .expect(201);

    expect(second.body).toMatchObject({ version: 2, resumed: false });
    expect(second.body.id).not.toBe(first.body.id);

    const old = await context.prisma.lessonAttempt.findUniqueOrThrow({
      where: { id: first.body.id as string },
    });
    expect(old.status).toBe(LessonAttemptStatus.ABANDONED);
    expect(old.abandonedAt).not.toBeNull();
  });

  it('lição sem versão publicada não abre tentativa', async () => {
    const auth = { Authorization: `Bearer ${await studentToken()}` };
    const id = await lessonId();

    await context.prisma.lesson.update({
      where: { id },
      data: { publishedVersionId: null },
    });

    await http().post(`/lessons/${id}/attempts`).set(auth).send({}).expect(404);
  });
});
