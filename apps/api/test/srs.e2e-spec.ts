import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import request from 'supertest';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';
const DAY_MS = 86_400_000;

/**
 * Módulo 9: o aluno completa a lição seed e revisa os cards que ela criou.
 *
 * A lição declara como target skill um punhado de skills e chunks; o item
 * da idade ("I have 20 years") não é target da lição — respondê-lo errado
 * de propósito é o que cria o card de VOCAB e o de ERROR_PATTERN pela via
 * reativa (`onWrongFirstTry`), separada da criação em massa por
 * `lesson.completed`.
 */
describe('Srs (e2e)', () => {
  let context: TestApp;
  let schedulingQueue: Queue;
  let learningQueue: Queue;
  let learnerQueue: Queue;
  let emitter: EventEmitter2;
  let events: DomainEvent[] = [];

  const capture = (name: string | string[], event: unknown) => {
    if (typeof name === 'string' && /^(lesson|answer|review)\./.test(name)) {
      events.push(event as DomainEvent);
    }
  };

  beforeAll(async () => {
    context = await createTestApp();
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

  /**
   * `obliterate` limpa a fila, mas não corta um worker que já pegou o job e
   * está no meio de uma transação — se `close()` truncar as tabelas nesse
   * instante, o Postgres pode dar deadlock entre o truncate e a escrita do
   * job. Espera as três filas ficarem ociosas antes de fechar.
   */
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
    await drainQueue(schedulingQueue);
    await drainQueue(learningQueue);
    await drainQueue(learnerQueue);
    await schedulingQueue?.obliterate({ force: true });
    await learningQueue?.obliterate({ force: true });
    await learnerQueue?.obliterate({ force: true });
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

  /** Completa a lição seed, errando de propósito a idade na primeira vez. */
  async function completeSeedLesson(
    auth: Record<string, string>,
  ): Promise<{ attemptId: string }> {
    const id = await lessonId();
    const items = await itemIds();

    const started = await http()
      .post(`/lessons/${id}/attempts`)
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
          itemId: items[slug],
          attemptId,
          context: 'LESSON',
          response,
          responseTimeMs: 4_000,
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

    // De propósito: "I have 20 years" é o erro clássico de brasileiro.
    const wrong = await answer('a1-type-im-20-years-old', {
      text: 'I have 20 years',
    });
    expect(wrong.body).toMatchObject({ isCorrect: false, isFirstTry: true });
    expect(wrong.body.errorPatterns).toEqual([
      expect.objectContaining({ id: 'l1.have-for-age' }),
    ]);
    // Retentativa: não conta mais como primeira, não mexe no card de novo.
    await answer('a1-type-im-20-years-old', { text: "I'm 20" });

    await step(2);
    await step(3, {
      timeSpentMs: 90_000,
      response: { text: "Hi! I'm Ana. I'm from Recife. Nice to meet you." },
    });
    await step(4);
    await step(5);

    await http().post(`/attempts/${attemptId}/complete`).set(auth).expect(200);

    return { attemptId };
  }

  const named = (name: string) => events.filter((event) => event.name === name);

  /**
   * A resposta errada e a conclusão da lição enfileiram dois jobs
   * separados. Espera pelos dois: `SKILL:grammar.be.present.affirmative`
   * só o job de `lesson.completed` cria — não basta ver "alguma linha".
   */
  async function waitForLessonCards() {
    return waitFor(async () => {
      const rows = await context.prisma.reviewCard.findMany();
      const done = rows.some(
        (row) =>
          row.kind === 'SKILL' &&
          row.refId === 'grammar.be.present.affirmative',
      );
      return done ? rows : null;
    }, 'os cards de revisão da lição');
  }

  // -------------------------------------------------------------------------

  it('completar a lição cria os cards de revisão, prontos para hoje', async () => {
    const token = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };

    await completeSeedLesson(auth);

    const cards = await waitForLessonCards();

    const keys = cards.map((card) => `${card.kind}:${card.refId}`);

    // Target skills e chunks da lição, criados por `lesson.completed`.
    expect(keys).toEqual(
      expect.arrayContaining([
        'SKILL:function.introduce-yourself',
        'SKILL:grammar.be.present.affirmative',
        'SKILL:grammar.contractions.be',
        'CHUNK:chunk.nice-to-meet-you',
        'CHUNK:chunk.where-are-you-from',
      ]),
    );
    // Skill principal do item da idade (vocabulário, não target da lição) e
    // o padrão de erro que ele revelou: só a via reativa cria estes dois.
    expect(keys).toEqual(
      expect.arrayContaining([
        'VOCAB:vocab.numbers-1-20',
        'ERROR_PATTERN:l1.have-for-age',
      ]),
    );

    expect(cards.every((card) => card.source === 'LESSON')).toBe(true);
    expect(cards.every((card) => card.state === 'NEW')).toBe(true);
    // Card novo já nasce vencido — pronto para a sessão de hoje.
    expect(cards.every((card) => card.due.getTime() <= Date.now())).toBe(true);

    expect(named('review.answered')).toHaveLength(0);
  });

  it('sessão de revisão: SKILL usa questão real, os outros viram flashcard', async () => {
    const token = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };

    await completeSeedLesson(auth);
    await waitForLessonCards();

    const session = await http()
      .get('/reviews/session?minutes=30')
      .set(auth)
      .expect(200);

    expect(Array.isArray(session.body)).toBe(true);
    expect(session.body.length).toBeGreaterThan(0);

    const skillCard = (
      session.body as { kind: string; exercise: { type: string } }[]
    ).find((card) => card.kind === 'SKILL');
    const flashcard = (
      session.body as { kind: string; exercise: { type: string } }[]
    ).find((card) => card.kind !== 'SKILL');

    expect(skillCard?.exercise.type).toBe('ITEM');
    // Sem gabarito na questão entregue.
    expect(JSON.stringify(skillCard?.exercise).toLowerCase()).not.toContain(
      'correctoptionids',
    );
    expect(flashcard?.exercise).toMatchObject({
      type: 'FLASHCARD',
      front: expect.any(String),
      back: expect.any(String),
    });
  });

  it('responder os cards agenda o próximo due — dias à frente, não hoje', async () => {
    const token = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };

    await completeSeedLesson(auth);
    await waitForLessonCards();

    const errorCard = await context.prisma.reviewCard.findFirstOrThrow({
      where: { kind: 'ERROR_PATTERN', refId: 'l1.have-for-age' },
    });
    const vocabCard = await context.prisma.reviewCard.findFirstOrThrow({
      where: { kind: 'VOCAB', refId: 'vocab.numbers-1-20' },
    });

    // Auto-avaliação EASY num card novo: o FSRS graduate direto pra REVIEW,
    // com o due dias à frente — o "em alguns dias" do critério de pronto.
    const easy = await http()
      .post(`/reviews/${errorCard.id}/answer`)
      .set(auth)
      .send({ kind: 'SELF_RATING', selfRating: 'EASY' })
      .expect(200);

    expect(easy.body.rating).toBe('EASY');
    expect(new Date(easy.body.due as string).getTime()).toBeGreaterThan(
      Date.now() + DAY_MS,
    );

    // GOOD só passos curtos (minutos) na primeira vez — confere que o due
    // avançou de "agora" mesmo sem virar dia.
    const good = await http()
      .post(`/reviews/${vocabCard.id}/answer`)
      .set(auth)
      .send({ kind: 'SELF_RATING', selfRating: 'GOOD' })
      .expect(200);

    expect(new Date(good.body.due as string).getTime()).toBeGreaterThan(
      Date.now(),
    );

    expect(named('review.answered')).toHaveLength(2);
    expect(named('review.answered').map((event) => event.payload)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'ERROR_PATTERN', rating: 'EASY' }),
        expect.objectContaining({ kind: 'VOCAB', rating: 'GOOD' }),
      ]),
    );

    // O learner-model (7) também reagiu — evidência de mastery pela via do
    // SRS, não só pela lição.
    await waitFor(async () => {
      const row = await context.prisma.learnerSkillState.findUnique({
        where: {
          userId_skillId: {
            userId: (
              await context.prisma.user.findUniqueOrThrow({
                where: { email: 'aluno@exemplo.com' },
                select: { id: true },
              })
            ).id,
            skillId: 'vocab.numbers-1-20',
          },
        },
      });
      return row !== null ? row : null;
    }, 'a evidência de mastery do vocabulário revisado');
  });

  it('card de SKILL respondido errado reagenda com Again; corpo errado num card dá 422', async () => {
    const token = await studentToken();
    const auth = { Authorization: `Bearer ${token}` };
    const items = await itemIds();

    await completeSeedLesson(auth);
    await waitForLessonCards();

    const skillCard = await context.prisma.reviewCard.findFirstOrThrow({
      where: { kind: 'SKILL', refId: 'grammar.be.present.affirmative' },
    });

    // Corpo de flashcard num card de SKILL: o servidor recusa, não adivinha.
    const mismatch = await http()
      .post(`/reviews/${skillCard.id}/answer`)
      .set(auth)
      .send({ kind: 'SELF_RATING', selfRating: 'GOOD' })
      .expect(422);
    expect(mismatch.body.error.code).toBe('REVIEW_CARD_KIND_MISMATCH');

    const wrong = await http()
      .post(`/reviews/${skillCard.id}/answer`)
      .set(auth)
      .send({
        kind: 'ITEM',
        itemId: items['a1-be-i-am-maya'],
        response: { optionIds: ['is'] },
        responseTimeMs: 3_000,
      })
      .expect(200);

    expect(wrong.body.rating).toBe('AGAIN');

    const updated = await context.prisma.reviewCard.findUniqueOrThrow({
      where: { id: skillCard.id },
    });
    // Card novo (NEW) errado ainda não é "lapso" pro FSRS — lapso só conta
    // quando um card já graduado pra REVIEW volta a errar. O que dá pra
    // conferir aqui é que o agendamento reagiu: mexeu de estado e de due.
    expect(updated.reps).toBe(1);
    expect(updated.state).not.toBe('NEW');
    expect(updated.due.getTime()).toBeGreaterThan(skillCard.due.getTime());
  });
});
