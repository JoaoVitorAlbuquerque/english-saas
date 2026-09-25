import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import request from 'supertest';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';
import type { FakeLlmProvider } from 'src/modules/ai/services/fake-llm.provider';
import { LlmProvider } from 'src/modules/ai/services/llm.provider';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';

import { billingSeed } from '../prisma/seeds/billing.seed';
import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';
const CRITERION =
  'Hi Maya! i am Ana. I from Brazil, I live in the Recife. I have 22 years.';

/**
 * Módulo 12, com o FakeLlmProvider: o "tutor de mentira" das fixtures
 * reconhece os erros clássicos e mapeia para os ErrorPatterns do catálogo.
 * O que o teste prova é o caminho: crédito, job, id que a IA inventa sendo
 * descartado, `tutor.feedback`, perfil do aluno e cards do SRS.
 */
describe('Tutor (e2e)', () => {
  let context: TestApp;
  let fake: FakeLlmProvider;
  let credits: AiCreditService;
  let emitter: EventEmitter2;
  let events: DomainEvent[] = [];
  const queues: Queue[] = [];

  const capture = (name: string | string[], event: unknown) => {
    if (name === 'tutor.feedback') {
      events.push(event as DomainEvent);
    }
  };

  beforeAll(async () => {
    context = await createTestApp();
    fake = context.app.get(LlmProvider) as FakeLlmProvider;
    credits = context.app.get(AiCreditService);
    emitter = context.app.get(EventEmitter2);
    emitter.onAny(capture);

    for (const name of [
      QUEUES.TUTOR,
      QUEUES.BILLING,
      QUEUES.LEARNER_UPDATES,
      QUEUES.SCHEDULING,
    ]) {
      queues.push(context.app.get<Queue>(getQueueToken(name)));
    }
  });

  beforeEach(async () => {
    await drainAll();
    fake.reset();
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.resetRateLimit();
    await curriculumSeed.run(context.prisma);
    await billingSeed.run(context.prisma);
    events = [];
  });

  afterAll(async () => {
    emitter?.offAny(capture);
    await drainAll();
    for (const queue of queues) {
      await queue.obliterate({ force: true });
    }
    await context?.close();
  });

  async function drainAll(timeoutMs = 8_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    for (const queue of queues) {
      for (;;) {
        const counts = await queue.getJobCounts('active', 'waiting', 'delayed');
        const pending =
          (counts['active'] ?? 0) +
          (counts['waiting'] ?? 0) +
          (counts['delayed'] ?? 0);

        if (pending === 0 || Date.now() > deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
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
        throw new Error(`Tempo esgotado esperando: ${what}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  const http = () => request(context.app.getHttpServer());

  /** Aluno FREE com os 10 créditos do mês já creditados. */
  async function student(email = 'ana@exemplo.com') {
    const signup = await http()
      .post('/auth/signup')
      .send({
        name: 'Ana',
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);
    const userId = signup.body.user.id as string;

    await waitFor(
      async () => ((await credits.balanceFor(userId)) === 10 ? true : null),
      'créditos do FREE',
    );

    return {
      userId,
      auth: { Authorization: `Bearer ${signup.body.accessToken as string}` },
    };
  }

  async function stepIndex(type: 'FREE_PRODUCTION' | 'ROLEPLAY') {
    const lesson = await context.prisma.lesson.findUniqueOrThrow({
      where: { slug: 'nice-to-meet-you' },
      select: {
        id: true,
        publishedVersion: {
          select: {
            steps: { orderBy: { order: 'asc' }, select: { type: true } },
          },
        },
      },
    });
    const index =
      lesson.publishedVersion?.steps.findIndex((step) => step.type === type) ??
      -1;

    return { lessonId: lesson.id, stepIndex: index };
  }

  async function correct(auth: Record<string, string>, body: object) {
    const created = await http()
      .post('/tutor/corrections')
      .set(auth)
      .send(body)
      .expect(202);

    return waitFor(async () => {
      const row = await context.prisma.tutorCorrection.findUnique({
        where: { id: created.body.id as string },
      });
      return row !== null && row.status !== 'QUEUED' ? row : null;
    }, 'correção processada');
  }

  it('corrige a frase do critério, mapeia os erros e eles aparecem no perfil', async () => {
    const { userId, auth } = await student();
    const step = await stepIndex('FREE_PRODUCTION');

    const done = await correct(auth, { ...step, text: CRITERION });
    expect(done.status).toBe('DONE');

    const res = await http()
      .get(`/tutor/corrections/${done.id}`)
      .set(auth)
      .expect(200);
    const fixes = res.body.result.fixes as {
      original: string;
      explanationPtBr: string;
      errorPatternId: string | null;
    }[];

    expect(fixes.map((fix) => fix.errorPatternId)).toEqual(
      expect.arrayContaining(['l1.have-for-age', 'article.country-the']),
    );
    expect(fixes.every((fix) => fix.explanationPtBr.length > 0)).toBe(true);
    expect(
      res.body.result.rubric.map((r: { goalId: string }) => r.goalId),
    ).toEqual(expect.arrayContaining(['no-have-for-age']));
    expect(res.body.result.registerTips.length).toBeGreaterThan(0);
    expect(await credits.balanceFor(userId)).toBe(9);

    // tutor.feedback com a frase real e o erro que a rubrica vigiava.
    const [feedback] = events as DomainEvent<'tutor.feedback'>[];
    expect(feedback?.payload).toMatchObject({
      source: 'CORRECTION',
      feedbackId: done.id,
      checkedErrorPatternIds: ['l1.have-for-age'],
    });
    expect(feedback?.payload.errorPatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'l1.have-for-age',
          text: 'I have 22 years',
        }),
        expect.objectContaining({ id: 'article.country-the' }),
      ]),
    );

    // Perfil do aluno: os dois erros observados, com a frase dele.
    const profile = await waitFor(async () => {
      const body = (
        await http().get('/me/learner-profile').set(auth).expect(200)
      ).body as { observedErrors: { id: string; yourExamples: string[] }[] };
      return body.observedErrors.length >= 2 ? body : null;
    }, 'erros no perfil');
    expect(profile.observedErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'l1.have-for-age',
          yourExamples: ['I have 22 years'],
        }),
        expect.objectContaining({ id: 'article.country-the' }),
      ]),
    );

    // SRS: card de cada erro, vindo do tutor.
    const cards = await waitFor(async () => {
      const rows = await context.prisma.reviewCard.findMany({
        where: { userId, kind: 'ERROR_PATTERN' },
      });
      return rows.length >= 2 ? rows : null;
    }, 'cards dos erros');
    expect(cards.map((card) => card.source)).toEqual([
      'TUTOR_FEEDBACK',
      'TUTOR_FEEDBACK',
    ]);

    // Mais duas vezes o mesmo erro: vira recorrente e a skill ligada, fraqueza.
    await correct(auth, { text: 'I have 30 years and I like music.' });
    await correct(auth, {
      text: 'My brother have 18 years? No, I have 23 years.',
    });

    const weak = await waitFor(async () => {
      const body = (
        await http().get('/me/learner-profile').set(auth).expect(200)
      ).body as {
        errors: { id: string }[];
        weaknesses: { skillId: string }[];
      };
      return body.errors.some((error) => error.id === 'l1.have-for-age')
        ? body
        : null;
    }, 'erro recorrente');
    expect(weak.weaknesses.map((w) => w.skillId)).toContain(
      'grammar.be.present.affirmative',
    );
  });

  it('IA quebrada: a correção falha e o crédito volta', async () => {
    const { userId, auth } = await student();
    fake.setFixture('tutor-correction', { value: { nonsense: true } });

    const failed = await correct(auth, { text: 'I have 22 years.' });

    expect(failed.status).toBe('FAILED');
    expect(await credits.balanceFor(userId)).toBe(10);
    expect(events).toHaveLength(0);

    const res = await http()
      .get(`/tutor/corrections/${failed.id}`)
      .set(auth)
      .expect(200);
    expect(res.body.message).toContain('crédito voltou');
  });

  it('conteúdo impróprio é recusado sem cobrar', async () => {
    const { userId, auth } = await student();

    const refused = await correct(auth, { text: 'INAPPROPRIATE_TEST blah' });

    expect(refused.status).toBe('REFUSED');
    expect(await credits.balanceFor(userId)).toBe(10);
    expect(events).toHaveLength(0);
  });

  it('sem saldo é 402 na hora; reenviar o mesmo pedido não cobra duas vezes', async () => {
    const { userId, auth } = await student();
    const body = { text: 'I have 22 years.', clientRequestId: 'req-1' };

    const first = await http()
      .post('/tutor/corrections')
      .set(auth)
      .send(body)
      .expect(202);
    const again = await http()
      .post('/tutor/corrections')
      .set(auth)
      .send(body)
      .expect(202);
    expect(again.body.id).toBe(first.body.id);
    expect(await credits.balanceFor(userId)).toBe(9);

    await context.prisma.aiCreditLedgerEntry.create({
      data: { userId, kind: 'CONSUME', amount: -9, reason: 'teste' },
    });
    const broke = await http()
      .post('/tutor/corrections')
      .set(auth)
      .send({ text: 'Hello there.' })
      .expect(402);
    expect(broke.body.error.code).toBe('INSUFFICIENT_AI_CREDITS');
  });

  describe('roleplay', () => {
    async function start(auth: Record<string, string>) {
      const step = await stepIndex('ROLEPLAY');
      const res = await http()
        .post('/tutor/roleplays')
        .set(auth)
        .send(step)
        .expect(201);
      return res.body as { id: string; maxTurns: number; turns: unknown[] };
    }

    async function say(auth: Record<string, string>, id: string, text: string) {
      await http()
        .post(`/tutor/roleplays/${id}/turns`)
        .set(auth)
        .send({ text })
        .expect(202);

      return waitFor(async () => {
        const res = await http()
          .get(`/tutor/roleplays/${id}`)
          .set(auth)
          .expect(200);
        const turns = res.body.turns as { status: string }[];
        return turns.every((turn) => turn.status !== 'PENDING')
          ? res.body
          : null;
      }, 'resposta do personagem');
    }

    it('cumpre as metas, encerra com resumo e as expressões viram card', async () => {
      const { userId, auth } = await student();
      const session = await start(auth);

      // FREE: teto de 6 falas, menor que as 10 da etapa.
      expect(session.maxTurns).toBe(6);
      expect(session.turns).toHaveLength(1);
      expect(await credits.balanceFor(userId)).toBe(7);

      const first = await say(
        auth,
        session.id,
        'Hi! My name is Ana. I have 22 years.',
      );
      const reply = first.turns[2];
      expect(reply.feedback.inlineCorrection).toMatchObject({
        errorPatternId: 'l1.have-for-age',
      });
      // A expressão inventada pela IA some; a do catálogo fica.
      expect(reply.feedback.expressionSkillIds).toEqual(['chunk.my-name-is']);

      const last = await say(auth, session.id, "Yes! I'm from Brazil.");
      expect(last.status).toBe('FINISHED');
      expect(last.summary).toMatchObject({ finishedBy: 'GOALS' });
      expect(last.summary.topCorrections[0]).toMatchObject({
        original: 'I have 22 years',
      });

      await http()
        .post(`/tutor/roleplays/${session.id}/turns`)
        .set(auth)
        .send({ text: 'Bye!' })
        .expect(409);

      const feedback = events.find(
        (event) =>
          (event as DomainEvent<'tutor.feedback'>).payload.source ===
          'ROLEPLAY',
      ) as DomainEvent<'tutor.feedback'> | undefined;
      expect(feedback?.payload.expressionSkillIds).toEqual([
        'chunk.my-name-is',
      ]);

      const expressionCard = await waitFor(async () => {
        const row = await context.prisma.reviewCard.findFirst({
          where: { userId, refId: 'chunk.my-name-is' },
        });
        return row;
      }, 'card da expressão');
      expect(expressionCard.source).toBe('TUTOR_FEEDBACK');
    });

    it('limite de turnos do plano: esgotou, a conversa fecha', async () => {
      const { auth } = await student();
      const session = await start(auth);

      let view: { status: string; turnsLeft: number } | null = null;
      for (let turn = 0; turn < session.maxTurns; turn += 1) {
        view = await say(auth, session.id, 'ok');
      }

      expect(view).toMatchObject({ status: 'FINISHED', turnsLeft: 0 });
      const extra = await http()
        .post(`/tutor/roleplays/${session.id}/turns`)
        .set(auth)
        .send({ text: 'hello?' })
        .expect(409);
      expect(extra.body.error.code).toBe('ROLEPLAY_FINISHED');
    });

    it('se o personagem nunca responde, a sessão acaba e o crédito volta', async () => {
      const { userId, auth } = await student();
      const session = await start(auth);
      fake.setFixture('tutor-roleplay-turn', { value: { reply: 42 } });

      const view = await say(auth, session.id, 'Hi!');

      expect(view.status).toBe('FINISHED');
      expect(await credits.balanceFor(userId)).toBe(10);
    });

    it('cenário livre é do Plus', async () => {
      const { auth } = await student();

      const res = await http()
        .post('/tutor/roleplays')
        .set(auth)
        .send({
          scenarioFreeText: 'Pedindo um café numa cafeteria em Londres.',
        })
        .expect(403);
      expect(res.body.error.code).toBe('FEATURE_NOT_AVAILABLE');
    });
  });

  it('voz vem desligada', async () => {
    const { auth } = await student();

    const res = await http()
      .post('/tutor/corrections/audio')
      .set(auth)
      .attach('audio', Buffer.from('ID3fake'), 'fala.mp3')
      .expect(403);
    expect(res.body.error.code).toBe('VOICE_DISABLED');
  });
});
