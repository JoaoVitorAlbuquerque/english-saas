import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ReviewCardKind,
  ReviewCardSource,
  ReviewCardState,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';
const DAY_MS = 86_400_000;

/**
 * Módulo 10: cronograma automático a partir do aluno seed.
 *
 * Um aluno com 20 min/dia recebe um plano e uma agenda coerentes, sem
 * estourar o orçamento — nem depois de acumular revisão de vários dias.
 * Recomendação nunca trava: `NEEDS_REINFORCEMENT` no checkpoint entra no
 * plano como prioridade, não como bloqueio.
 */
describe('Planner (e2e)', () => {
  let context: TestApp;
  let plannerQueue: Queue;
  let schedulingQueue: Queue;
  let learningQueue: Queue;
  let learnerQueue: Queue;
  let emitter: EventEmitter2;
  let events: DomainEvent[] = [];

  const capture = (name: string | string[], event: unknown) => {
    if (
      typeof name === 'string' &&
      /^(lesson|checkpoint|placement|profile|user\.onboarded)/.test(name)
    ) {
      events.push(event as DomainEvent);
    }
  };

  beforeAll(async () => {
    context = await createTestApp();
    plannerQueue = context.app.get<Queue>(getQueueToken(QUEUES.PLANNER));
    schedulingQueue = context.app.get<Queue>(getQueueToken(QUEUES.SCHEDULING));
    learningQueue = context.app.get<Queue>(getQueueToken(QUEUES.LEARNING));
    learnerQueue = context.app.get<Queue>(
      getQueueToken(QUEUES.LEARNER_UPDATES),
    );
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

  /** Mesmo motivo do srs (9): não deixa o `close()` truncar em cima de um job vivo. */
  async function drainQueue(queue: Queue, timeoutMs = 5_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed');
      const pending =
        (counts['active'] ?? 0) +
        (counts['waiting'] ?? 0) +
        (counts['delayed'] ?? 0);

      if (pending === 0 || Date.now() > deadline) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  afterAll(async () => {
    emitter?.offAny(capture);
    await drainQueue(plannerQueue);
    await drainQueue(schedulingQueue);
    await drainQueue(learningQueue);
    await drainQueue(learnerQueue);
    await plannerQueue?.obliterate({ force: true });
    await schedulingQueue?.obliterate({ force: true });
    await learningQueue?.obliterate({ force: true });
    await learnerQueue?.obliterate({ force: true });
    await context?.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function studentWithPlan(
    email = 'aluno@exemplo.com',
    dailyMinutes = 20,
  ): Promise<{ userId: string; auth: Record<string, string> }> {
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
    const auth = {
      Authorization: `Bearer ${signup.body.accessToken as string}`,
    };

    await http()
      .post('/me/onboarding')
      .set(auth)
      .send({
        goals: ['WORK'],
        availabilityMinutes: {
          mon: dailyMinutes,
          tue: dailyMinutes,
          wed: dailyMinutes,
          thu: dailyMinutes,
          fri: dailyMinutes,
          sat: dailyMinutes,
          sun: dailyMinutes,
        },
        selfReportedLevel: 'NONE',
        interests: [],
      })
      .expect(201);

    const me = await http().get('/me').set(auth).expect(200);

    return { userId: me.body.id as string, auth };
  }

  async function waitFor<T>(
    read: () => Promise<T | null>,
    what: string,
    timeoutMs = 20_000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const value = await read();
      if (value !== null) return value;
      if (Date.now() > deadline) {
        throw new Error(
          `Esperei ${what} por ${String(timeoutMs)}ms e não veio.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  function wrongResponse(type: string, content: Prisma.JsonValue): object {
    const value = (content ?? {}) as Record<string, unknown>;

    switch (type) {
      case 'MULTIPLE_CHOICE':
      case 'LISTEN_CHOOSE':
      case 'READING_COMPREHENSION': {
        const options = value['options'] as { id: string }[];
        const correct = new Set(value['correctOptionIds'] as string[]);
        const wrong = options.find((option) => !correct.has(option.id));
        return { optionIds: [wrong?.id ?? ''] };
      }
      case 'ORDER_WORDS':
        return { tokens: [...(value['tokens'] as string[])].reverse() };
      case 'MATCH': {
        const pairs = value['pairs'] as { left: string; right: string }[];
        return {
          pairs: pairs.map((pair, index) => ({
            left: pair.left,
            right: pairs[(index + 1) % pairs.length]?.right ?? pair.right,
          })),
        };
      }
      default:
        return { text: 'zzz' };
    }
  }

  // -------------------------------------------------------------------------

  it('aluno com 20 min/dia recebe um plano e uma agenda coerentes', async () => {
    const { auth } = await studentWithPlan();

    const rebuild = await http()
      .post('/me/plan/rebuild')
      .set(auth)
      .send({})
      .expect(200);

    expect(rebuild.body.targetLevel).toBe('C1');
    expect((rebuild.body.path as unknown[]).length).toBeGreaterThan(0);
    expect(rebuild.body.forecast.estimatedArrival).not.toBeNull();

    const agenda = await http().get('/me/agenda').set(auth).expect(200);
    const blocks = agenda.body.blocks as {
      type: string;
      estimatedMinutes: number;
      reason: string;
    }[];

    expect(blocks.length).toBeGreaterThan(0);

    const total = blocks.reduce(
      (sum, block) => sum + block.estimatedMinutes,
      0,
    );
    expect(total).toBeLessThanOrEqual(20);

    for (const block of blocks) {
      expect(block.reason.length).toBeGreaterThan(0);
    }

    // Aluno novo, sem revisão nem reforço ainda: a próxima lição da trilha.
    expect(blocks[0]?.type).toBe('LESSON');
  });

  it('completar a lição sugerida tira ela do path', async () => {
    const { auth } = await studentWithPlan();
    await http().post('/me/plan/rebuild').set(auth).send({}).expect(200);

    const lessonRow = await context.prisma.lesson.findUniqueOrThrow({
      where: { slug: 'nice-to-meet-you' },
      select: { id: true },
    });

    const plan = await http().get('/me/plan').set(auth).expect(200);
    const path = plan.body.path as { lessonId: string }[];
    expect(path.some((entry) => entry.lessonId === lessonRow.id)).toBe(true);

    const items = await context.prisma.item.findMany({
      where: { slug: { not: null } },
      select: { id: true, slug: true },
    });
    const itemBySlug = Object.fromEntries(
      items.map((row) => [row.slug ?? '', row.id]),
    );

    const started = await http()
      .post(`/lessons/${lessonRow.id}/attempts`)
      .set(auth)
      .send({ source: 'PLAN' })
      .expect(201);
    const attemptId = started.body.id as string;

    const step = (index: number, body: object = { timeSpentMs: 20_000 }) =>
      http()
        .post(`/attempts/${attemptId}/steps/${String(index)}/complete`)
        .set(auth)
        .send(body)
        .expect(200);

    await step(0);
    await step(1);

    const answer = (slug: string, response: object) =>
      http()
        .post('/answers')
        .set(auth)
        .send({
          itemId: itemBySlug[slug],
          attemptId,
          context: 'LESSON',
          response,
          responseTimeMs: 3_000,
        })
        .expect(201);

    await answer('a1-be-i-am-maya', { optionIds: ['am'] });
    await answer('a1-listen-hes-friendly', { optionIds: ['contracted'] });
    await answer('a1-order-im-from-brazil', {
      tokens: ["I'm", 'from', 'Brazil'],
    });
    await answer('a1-fill-biscuit-is-a-dog', { text: 'is' });
    await answer('a1-reply-nice-to-meet-you', { optionIds: ['too'] });
    await answer('a1-order-nice-to-meet-you', {
      tokens: ['Nice', 'to', 'meet', 'you'],
    });
    await answer('a1-type-shes-from-austin', { text: 'she is from austin' });
    await answer('a1-type-im-20-years-old', { text: "I'm 20" });

    await step(2);
    await step(3, {
      timeSpentMs: 90_000,
      response: { text: "Hi! I'm Ana. I'm from Recife. Nice to meet you." },
    });
    await step(4);
    await step(5);

    await http().post(`/attempts/${attemptId}/complete`).set(auth).expect(200);

    const updated = await waitFor(async () => {
      const row = await context.prisma.studyPlan.findUnique({
        where: {
          userId: (
            await context.prisma.user.findUniqueOrThrow({
              where: { email: 'aluno@exemplo.com' },
              select: { id: true },
            })
          ).id,
        },
      });
      if (row === null) return null;
      const currentPath = row.path as unknown as { lessonId: string }[];
      return currentPath.some((entry) => entry.lessonId === lessonRow.id)
        ? null
        : row;
    }, 'a lição sair do path');

    const finalPath = updated.path as unknown as { lessonId: string }[];
    expect(finalPath.some((entry) => entry.lessonId === lessonRow.id)).toBe(
      false,
    );
  });

  it('checkpoint com reforço necessário entra no plano e puxa prática na agenda', async () => {
    const { userId, auth } = await studentWithPlan();
    await http().post('/me/plan/rebuild').set(auth).send({}).expect(200);

    const unit = await context.prisma.unit.findUniqueOrThrow({
      where: { slug: 'a1-u1-new-neighbors' },
      select: { id: true },
    });

    let state = await http()
      .post(`/checkpoints/${unit.id}/start`)
      .set(auth)
      .expect(200);
    const checkpointId = state.body.id as string;
    let answered = 0;

    while (state.body.result === null && answered < 15) {
      const next = state.body.next as { id: string };
      const item = await context.prisma.item.findUniqueOrThrow({
        where: { id: next.id },
      });

      state = await http()
        .post(`/checkpoints/${checkpointId}/answer`)
        .set(auth)
        .send({
          itemId: item.id,
          response: wrongResponse(item.type, item.content),
          responseTimeMs: 4_000,
        })
        .expect(200);
      answered += 1;
    }

    expect(state.body.result.result).toBe('NEEDS_REINFORCEMENT');

    const plan = await waitFor(async () => {
      const row = await context.prisma.studyPlan.findUnique({
        where: { userId },
      });
      return row !== null && row.reinforceSkillIds.length > 0 ? row : null;
    }, 'o reforço entrar no plano');

    expect(plan.reinforceSkillIds.length).toBeGreaterThan(0);

    const agenda = await http().get('/me/agenda').set(auth).expect(200);
    const blocks = agenda.body.blocks as {
      type: string;
      estimatedMinutes: number;
    }[];
    const total = blocks.reduce(
      (sum, block) => sum + block.estimatedMinutes,
      0,
    );
    expect(total).toBeLessThanOrEqual(20);
  });

  it('perder vários dias de revisão não estoura o orçamento do dia', async () => {
    const { userId, auth } = await studentWithPlan();
    await http().post('/me/plan/rebuild').set(auth).send({}).expect(200);

    // Simula o backlog de quem ficou dias sem estudar: 40 cards vencidos.
    const overdue = new Date(Date.now() - 3 * DAY_MS);
    await context.prisma.reviewCard.createMany({
      data: Array.from({ length: 40 }, (_, index) => ({
        userId,
        kind: ReviewCardKind.SKILL,
        refId: `sim.skill.${String(index)}`,
        source: ReviewCardSource.LESSON,
        due: overdue,
        stability: 2,
        difficulty: 5,
        scheduledDays: 1,
        learningSteps: 0,
        reps: 1,
        lapses: 0,
        state: ReviewCardState.REVIEW,
        lastReviewedAt: overdue,
      })),
    });

    const agenda = await http().get('/me/agenda').set(auth).expect(200);
    const blocks = agenda.body.blocks as {
      type: string;
      estimatedMinutes: number;
    }[];
    const total = blocks.reduce(
      (sum, block) => sum + block.estimatedMinutes,
      0,
    );

    expect(total).toBeLessThanOrEqual(20);
    expect(blocks.some((block) => block.type === 'REVIEW')).toBe(true);
  });

  it('pular um bloco com motivo persiste dentro do mesmo dia', async () => {
    const { auth } = await studentWithPlan();
    await http().post('/me/plan/rebuild').set(auth).send({}).expect(200);

    const agenda = await http().get('/me/agenda').set(auth).expect(200);
    const blockId = (agenda.body.blocks as { id: string }[])[0]?.id as string;

    const skipped = await http()
      .post(`/me/agenda/blocks/${blockId}/skip`)
      .set(auth)
      .send({ reason: 'TOO_HARD' })
      .expect(200);
    const skippedBlock = (
      skipped.body.blocks as {
        id: string;
        status: string;
        skipReason: string;
      }[]
    ).find((block) => block.id === blockId);
    expect(skippedBlock).toMatchObject({
      status: 'SKIPPED',
      skipReason: 'TOO_HARD',
    });

    const again = await http().get('/me/agenda').set(auth).expect(200);
    expect(
      (again.body.blocks as { id: string; status: string }[]).find(
        (block) => block.id === blockId,
      )?.status,
    ).toBe('SKIPPED');

    // `OTHER` com nota livre — pular de novo troca o motivo (mudou de ideia).
    const withNote = await http()
      .post(`/me/agenda/blocks/${blockId}/skip`)
      .set(auth)
      .send({ reason: 'OTHER', note: 'Já revisei isso ontem à noite' })
      .expect(200);
    expect(
      (
        withNote.body.blocks as {
          id: string;
          skipReason: string;
          skipNote: string;
        }[]
      ).find((block) => block.id === blockId),
    ).toMatchObject({
      skipReason: 'OTHER',
      skipNote: 'Já revisei isso ontem à noite',
    });
  });

  it('concluir um bloco soma nos minutos do dia; repetir não soma de novo', async () => {
    const { auth } = await studentWithPlan();
    await http().post('/me/plan/rebuild').set(auth).send({}).expect(200);

    const agenda = await http().get('/me/agenda').set(auth).expect(200);
    expect(agenda.body.minutesCompleted).toBe(0);
    const block = (
      agenda.body.blocks as { id: string; estimatedMinutes: number }[]
    )[0];
    const blockId = block?.id as string;

    const completed = await http()
      .post(`/me/agenda/blocks/${blockId}/complete`)
      .set(auth)
      .send({ minutesSpent: 7 })
      .expect(200);
    expect(
      (
        completed.body.blocks as {
          id: string;
          status: string;
          minutesSpent: number;
        }[]
      ).find((entry) => entry.id === blockId),
    ).toMatchObject({ status: 'COMPLETED', minutesSpent: 7 });
    expect(completed.body.minutesCompleted).toBe(7);

    // Repetir não soma de nova — fica com os 7 minutos da primeira vez.
    const again = await http()
      .post(`/me/agenda/blocks/${blockId}/complete`)
      .set(auth)
      .send({ minutesSpent: 99 })
      .expect(200);
    expect(again.body.minutesCompleted).toBe(7);

    // Pular depois de concluído não desfaz.
    const skipAfter = await http()
      .post(`/me/agenda/blocks/${blockId}/skip`)
      .set(auth)
      .send({ reason: 'NO_TIME' })
      .expect(200);
    expect(
      (skipAfter.body.blocks as { id: string; status: string }[]).find(
        (entry) => entry.id === blockId,
      )?.status,
    ).toBe('COMPLETED');
  });

  it('concluir a lição sugerida marca o bloco na mesma agenda, sem apagar o resto do dia', async () => {
    const { userId, auth } = await studentWithPlan();
    await http().post('/me/plan/rebuild').set(auth).send({}).expect(200);

    const lessonRow = await context.prisma.lesson.findUniqueOrThrow({
      where: { slug: 'nice-to-meet-you' },
      select: { id: true },
    });

    const agenda = await http().get('/me/agenda').set(auth).expect(200);
    const blocks = agenda.body.blocks as {
      id: string;
      type: string;
      refId: string;
    }[];
    const lessonBlock = blocks.find(
      (block) => block.type === 'LESSON' && block.refId === lessonRow.id,
    );
    expect(lessonBlock).toBeDefined();

    // Pula um outro bloco pra provar que ele sobrevive ao término da lição.
    const otherBlock = blocks.find((block) => block.id !== lessonBlock?.id);
    if (otherBlock !== undefined) {
      await http()
        .post(`/me/agenda/blocks/${otherBlock.id}/skip`)
        .set(auth)
        .send({ reason: 'NO_TIME' })
        .expect(200);
    }

    const items = await context.prisma.item.findMany({
      where: { slug: { not: null } },
      select: { id: true, slug: true },
    });
    const itemBySlug = Object.fromEntries(
      items.map((row) => [row.slug ?? '', row.id]),
    );

    const started = await http()
      .post(`/lessons/${lessonRow.id}/attempts`)
      .set(auth)
      .send({ source: 'PLAN' })
      .expect(201);
    const attemptId = started.body.id as string;

    const step = (index: number, body: object = { timeSpentMs: 20_000 }) =>
      http()
        .post(`/attempts/${attemptId}/steps/${String(index)}/complete`)
        .set(auth)
        .send(body)
        .expect(200);

    const answer = (slug: string, response: object) =>
      http()
        .post('/answers')
        .set(auth)
        .send({
          itemId: itemBySlug[slug],
          attemptId,
          context: 'LESSON',
          response,
          responseTimeMs: 3_000,
        })
        .expect(201);

    await step(0);
    await step(1);
    await answer('a1-be-i-am-maya', { optionIds: ['am'] });
    await answer('a1-listen-hes-friendly', { optionIds: ['contracted'] });
    await answer('a1-order-im-from-brazil', {
      tokens: ["I'm", 'from', 'Brazil'],
    });
    await answer('a1-fill-biscuit-is-a-dog', { text: 'is' });
    await answer('a1-reply-nice-to-meet-you', { optionIds: ['too'] });
    await answer('a1-order-nice-to-meet-you', {
      tokens: ['Nice', 'to', 'meet', 'you'],
    });
    await answer('a1-type-shes-from-austin', { text: 'she is from austin' });
    await answer('a1-type-im-20-years-old', { text: "I'm 20" });
    await step(2);
    await step(3, {
      timeSpentMs: 90_000,
      response: { text: "Hi! I'm Ana. I'm from Recife. Nice to meet you." },
    });
    await step(4);
    await step(5);
    await http().post(`/attempts/${attemptId}/complete`).set(auth).expect(200);

    await waitFor(async () => {
      const row = await context.prisma.studyPlan.findUnique({
        where: { userId },
      });
      const currentPath = (row?.path ?? []) as unknown as {
        lessonId: string;
      }[];
      return currentPath.some((entry) => entry.lessonId === lessonRow.id)
        ? null
        : row;
    }, 'a lição sair do path');

    const after = await waitFor(async () => {
      const view = await http().get('/me/agenda').set(auth).expect(200);
      const updatedLessonBlock = (
        view.body.blocks as { id: string; type: string; status: string }[]
      ).find((block) => block.id === lessonBlock?.id);
      return updatedLessonBlock?.status === 'COMPLETED' ? view : null;
    }, 'o bloco da lição marcar concluído');

    // O bloco pulado antes continua pulado — a agenda não foi refeita.
    if (otherBlock !== undefined) {
      const survivedBlock = (
        after.body.blocks as { id: string; status: string }[]
      ).find((block) => block.id === otherBlock.id);
      expect(survivedBlock?.status).toBe('SKIPPED');
    }
  });

  it('bloco de prática vem com o item completo, sem gabarito', async () => {
    // Reforço setado direto no banco (como "perder vários dias de revisão"
    // faz com cards vencidos) — mastery nova começa em 0.5, abaixo dos 0.8
    // do threshold, então a skill já entra fraca sem precisar de checkpoint.
    const { userId, auth } = await studentWithPlan('aluno@exemplo.com', 120);
    await http().post('/me/plan/rebuild').set(auth).send({}).expect(200);

    await context.prisma.studyPlan.update({
      where: { userId },
      data: { reinforceSkillIds: ['grammar.be.present.affirmative'] },
    });

    const agenda = await http().get('/me/agenda').set(auth).expect(200);
    const blocks = agenda.body.blocks as {
      type: string;
      item?: { id: string; type: string; prompt: string; content: unknown };
    }[];
    const practiceBlock = blocks.find((block) => block.type === 'PRACTICE');

    expect(practiceBlock?.item).toMatchObject({
      id: expect.any(String),
      type: expect.any(String),
      prompt: expect.any(String),
      content: expect.any(Object),
    });
    expect(JSON.stringify(practiceBlock?.item).toLowerCase()).not.toContain(
      'correctoptionids',
    );
  });
});
