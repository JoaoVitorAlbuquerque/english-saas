import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import request from 'supertest';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';
import { RedisService } from 'src/infra/redis/redis.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';
import { LearnerUpdateService } from 'src/modules/learner-model/services/learner-update.service';

import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

/**
 * Módulo 7: o aluno faz a lição seed inteira, **insistindo** no erro mais
 * clássico de brasileiro — "I have 20 years" — três vezes antes de acertar.
 *
 * O worker da fila `learner-updates` está de pé, então o teste faz a lição
 * pela API e espera o modelo alcançar a última resposta (a marca d'água),
 * em vez de chamar o serviço na mão.
 */
describe('Learner model (e2e)', () => {
  let context: TestApp;
  let learnerQueue: Queue;
  let learningQueue: Queue;
  let emitter: EventEmitter2;
  let profiles: LearnerProfileService;
  let updates: LearnerUpdateService;
  let redis: RedisService;
  let events: DomainEvent[] = [];

  const capture = (name: string | string[], event: unknown) => {
    if (name === 'learner.model_updated') {
      events.push(event as DomainEvent);
    }
  };

  beforeAll(async () => {
    context = await createTestApp();
    learnerQueue = context.app.get<Queue>(
      getQueueToken(QUEUES.LEARNER_UPDATES),
    );
    learningQueue = context.app.get<Queue>(getQueueToken(QUEUES.LEARNING));
    emitter = context.app.get(EventEmitter2);
    profiles = context.app.get(LearnerProfileService);
    updates = context.app.get(LearnerUpdateService);
    redis = context.app.get(RedisService);
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
    await learnerQueue?.obliterate({ force: true });
    await learningQueue?.obliterate({ force: true });
    await context?.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function studentToken(): Promise<{ token: string; userId: string }> {
    const signup = await http()
      .post('/auth/signup')
      .send({
        name: 'Aluno',
        email: 'aluno@exemplo.com',
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);

    return {
      token: signup.body.accessToken as string,
      userId: signup.body.user.id as string,
    };
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

  /** Espera o modelo processar até a última resposta gravada do aluno. */
  async function waitForModel(userId: string): Promise<void> {
    const last = await context.prisma.answer.findFirstOrThrow({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });

    await waitFor(async () => {
      const cursor = await context.prisma.learnerModelCursor.findUnique({
        where: { userId },
      });
      return cursor?.lastAnswerId === last.id ? cursor : null;
    }, 'o modelo do aluno alcançar a última resposta');
  }

  /** Faz a lição seed inteira errando a idade três vezes. */
  async function doLessonWithAgeMistake(auth: { Authorization: string }) {
    const lesson = await context.prisma.lesson.findUniqueOrThrow({
      where: { slug: 'nice-to-meet-you' },
      select: { id: true },
    });
    const items = Object.fromEntries(
      (
        await context.prisma.item.findMany({
          where: { slug: { not: null } },
          select: { id: true, slug: true },
        })
      ).map((row) => [row.slug ?? '', row.id]),
    );

    const attempt = await http()
      .post(`/lessons/${lesson.id}/attempts`)
      .set(auth)
      .send({})
      .expect(201);
    const attemptId = attempt.body.id as string;

    const answer = (slug: string, response: object) =>
      http()
        .post('/answers')
        .set(auth)
        .send({
          itemId: items[slug],
          attemptId,
          context: 'LESSON',
          response,
          responseTimeMs: 3_000,
        })
        .expect(201);

    for (let index = 0; index < 6; index += 1) {
      if (index === 2) continue;
      await http()
        .post(`/attempts/${attemptId}/steps/${String(index)}/complete`)
        .set(auth)
        .send({})
        .expect((res) => {
          // A prática (2) fecha depois, com tudo respondido.
          if (res.status !== 200) throw new Error(String(res.status));
        });
    }

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
    await answer('a1-type-shes-from-austin', { text: "She's from Austin" });

    // O erro, de propósito, três vezes — e depois o acerto.
    const first = await answer('a1-type-im-20-years-old', {
      text: 'I have 20 years',
    });
    expect(first.body.errorPatterns[0]?.id).toBe('l1.have-for-age');
    await answer('a1-type-im-20-years-old', { text: 'I have 20 years old' });
    await answer('a1-type-im-20-years-old', { text: 'i have 20 years' });
    await answer('a1-type-im-20-years-old', { text: "I'm 20 years old" });

    await http()
      .post(`/attempts/${attemptId}/steps/2/complete`)
      .set(auth)
      .send({})
      .expect(200);
    await http().post(`/attempts/${attemptId}/complete`).set(auth).expect(200);
  }

  // -------------------------------------------------------------------------

  it('errar "I have 20 years" vira ponto fraco, com a skill como próximo alvo', async () => {
    const { token, userId } = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };

    await doLessonWithAgeMistake(auth);
    await waitForModel(userId);

    // --- o que o aluno vê ---

    const profile = await http()
      .get('/me/learner-profile')
      .set(auth)
      .expect(200);

    expect(profile.body.errors).toEqual([
      expect.objectContaining({
        id: 'l1.have-for-age',
        occurrences: 3,
        yourExamples: [
          'i have 20 years',
          'I have 20 years old',
          'I have 20 years',
        ],
      }),
    ]);
    expect(
      (profile.body.weaknesses as { skillId: string; why: string }[]).find(
        (weakness) => weakness.skillId === 'vocab.numbers-1-20',
      )?.why,
    ).toContain('idade');
    expect(
      (profile.body.needs as { skillId: string }[]).map((need) => need.skillId),
    ).toContain('vocab.numbers-1-20');
    // Sem onboarding e com pouca evidência: A1, e o aluno sabe por quê.
    expect(profile.body.overallLevel).toMatchObject({ level: 'A1' });
    expect(profile.body.competencies).toHaveLength(6);

    // --- o que a IA recebe ---

    const snapshot = await profiles.getSnapshot(userId);

    expect(snapshot.weaknesses.errorPatterns[0]).toMatchObject({
      id: 'l1.have-for-age',
      recentOccurrences: 3,
      examples: ['i have 20 years', 'I have 20 years old', 'I have 20 years'],
    });
    expect(snapshot.nextTargetSkills.map((skill) => skill.skillId)).toContain(
      'vocab.numbers-1-20',
    );
    expect(snapshot.nextTargetSkills.length).toBeLessThanOrEqual(5);
    expect(snapshot.recentTopics).toEqual(['Nice to meet you']);

    // --- o que ficou gravado ---

    // Theta só com a primeira tentativa: uma resposta de peso 1 na skill
    // principal do item de idade, mesmo com quatro envios.
    const numbers = await context.prisma.learnerSkillState.findUniqueOrThrow({
      where: { userId_skillId: { userId, skillId: 'vocab.numbers-1-20' } },
    });
    expect(numbers.evidenceCount).toBe(1);
    expect(numbers.theta).toBeLessThan(-2);

    const week = await context.prisma.learnerLevelSnapshot.findMany({
      where: { userId },
    });
    expect(week).toHaveLength(1);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(
      events.flatMap(
        (event) =>
          (event.payload as { errorPatternIds: string[] }).errorPatternIds,
      ),
    ).toContain('l1.have-for-age');

    // --- mastery por skill ---

    const skills = await http()
      .get('/me/skills')
      .query({ competency: 'VOCABULARY' })
      .set(auth)
      .expect(200);

    expect(skills.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 'vocab.numbers-1-20',
          competency: 'VOCABULARY',
          evidence: 1,
          status: 'UNKNOWN',
        }),
      ]),
    );
    expect(
      (skills.body.data as { competency: string }[]).every(
        (skill) => skill.competency === 'VOCABULARY',
      ),
    ).toBe(true);
  });

  it('resposta nova apaga o snapshot em cache', async () => {
    const { token, userId } = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };
    const key = LearnerProfileService.cacheKey(userId);

    await profiles.getSnapshot(userId);
    expect(await redis.client.get(key)).not.toBeNull();

    const item = await context.prisma.item.findUniqueOrThrow({
      where: { slug: 'a1-match-pronoun-be' },
      select: { id: true },
    });
    await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: item.id,
        context: 'REVIEW',
        response: { pairs: [{ left: 'I', right: 'am' }] },
        responseTimeMs: 2_000,
      })
      .expect(201);

    await waitFor(
      async () => ((await redis.client.get(key)) === null ? true : null),
      'o cache do snapshot sumir',
    );
    await waitForModel(userId);
  });

  it('reprocessar não conta nada duas vezes, nem com dois processos juntos', async () => {
    const { token, userId } = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };

    await doLessonWithAgeMistake(auth);
    await waitForModel(userId);

    const snapshotOf = async () =>
      (
        await context.prisma.learnerSkillState.findMany({
          where: { userId },
          orderBy: { skillId: 'asc' },
          select: { skillId: true, theta: true, evidenceCount: true },
        })
      ).map((row) => ({ ...row, theta: Math.round(row.theta * 1e6) / 1e6 }));

    const before = await snapshotOf();

    // A marca d'água chega na última resposta antes de os outros jobs (um
    // por resposta, todos sem nada a fazer) terminarem. Espera a fila parar,
    // senão um deles segura a trava bem na hora da disputa abaixo.
    await waitFor(async () => {
      const counts = await learnerQueue.getJobCounts(
        'active',
        'waiting',
        'delayed',
      );
      return Object.values(counts).every((count) => count === 0) ? true : null;
    }, 'a fila learner-updates esvaziar');

    // Nada novo depois da marca: não faz nada.
    expect(await updates.process(userId)).toEqual({
      status: 'DONE',
      processed: 0,
    });

    // Do zero, com dois processos disputando o mesmo aluno: a trava deixa
    // um passar, e a marca d'água garante que o resultado é o mesmo.
    await context.prisma.learnerSkillState.deleteMany({ where: { userId } });
    await context.prisma.learnerErrorPattern.deleteMany({ where: { userId } });
    await context.prisma.learnerModelCursor.deleteMany({ where: { userId } });

    const outcomes = await Promise.all([
      updates.process(userId),
      updates.process(userId),
    ]);
    const processed = outcomes.flatMap((outcome) =>
      outcome.status === 'DONE' ? [outcome.processed] : [],
    );

    // 11 respostas: as 8 questões, mais 3 retentativas da idade.
    expect(processed.reduce((sum, value) => sum + value, 0)).toBe(11);
    expect(await snapshotOf()).toEqual(before);

    const error = await context.prisma.learnerErrorPattern.findUniqueOrThrow({
      where: {
        userId_errorPatternId: { userId, errorPatternId: 'l1.have-for-age' },
      },
    });
    expect(error.totalOccurrences).toBe(3);
  });
});
