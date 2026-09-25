import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContentStatus, Role, type Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';
import { CalibrationService } from 'src/modules/assessment/services/calibration.service';

import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

/** PRNG com semente: o aluno simulado responde sempre do mesmo jeito. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Módulo 8 pela API.
 *
 * O nivelamento roda **sem o seed**: o banco do seed só tem A1, e o aluno
 * simulado precisa conhecer o gabarito de toda questão que cair. O teste
 * cria um banco sintético de 120 questões de −3 a +3 nas quatro
 * competências, e um aluno B1 (theta 0) responde pelo modelo de Rasch.
 */
describe('Assessment (e2e)', () => {
  let context: TestApp;
  let emitter: EventEmitter2;
  let calibration: CalibrationService;
  let queues: Queue[] = [];
  let events: DomainEvent[] = [];

  const capture = (name: string | string[], event: unknown) => {
    if (typeof name === 'string' && /^(placement|checkpoint)\./.test(name)) {
      events.push(event as DomainEvent);
    }
  };

  beforeAll(async () => {
    context = await createTestApp();
    emitter = context.app.get(EventEmitter2);
    calibration = context.app.get(CalibrationService);
    queues = [QUEUES.LEARNING, QUEUES.LEARNER_UPDATES, QUEUES.ASSESSMENT].map(
      (name) => context.app.get<Queue>(getQueueToken(name)),
    );
    emitter.onAny(capture);
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.resetRateLimit();
    events = [];
  });

  afterAll(async () => {
    emitter?.offAny(capture);
    for (const queue of queues) {
      await queue?.obliterate({ force: true });
    }
    await context?.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function signup(
    email: string,
  ): Promise<{ token: string; userId: string }> {
    const res = await http()
      .post('/auth/signup')
      .send({
        name: 'Aluno',
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);

    return {
      token: res.body.accessToken as string,
      userId: res.body.user.id as string,
    };
  }

  async function editorToken(): Promise<string> {
    const { userId } = await signup('editor@exemplo.com');
    await context.prisma.user.update({
      where: { id: userId },
      data: { role: Role.EDITOR },
    });
    const res = await http()
      .post('/auth/signin')
      .send({ email: 'editor@exemplo.com', password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function waitFor<T>(
    read: () => Promise<T | null>,
    what: string,
  ): Promise<T> {
    const deadline = Date.now() + 20_000;
    for (;;) {
      const value = await read();
      if (value !== null) return value;
      if (Date.now() > deadline) throw new Error(`Esperei ${what} e não veio.`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /** 120 questões de múltipla escolha, gabarito sempre `a`. */
  async function syntheticBank(): Promise<Map<string, number>> {
    const competencies = [
      'GRAMMAR',
      'VOCABULARY',
      'READING',
      'LISTENING',
    ] as const;

    for (const competency of competencies) {
      await context.prisma.skill.create({
        data: {
          id: `sim.${competency.toLowerCase()}`,
          type: 'GRAMMAR',
          competency,
          cefrLevel: 'B1',
          title: `Simulada ${competency}`,
        },
      });
    }

    const random = seeded(42);
    const difficulties = new Map<string, number>();

    for (let index = 0; index < 120; index += 1) {
      const competency = competencies[index % 4] ?? 'GRAMMAR';
      const difficulty = Math.round((-3 + 6 * random()) * 1_000) / 1_000;
      const item = await context.prisma.item.create({
        data: {
          type: 'MULTIPLE_CHOICE',
          prompt: `Questão simulada ${String(index)}`,
          content: {
            options: [
              { id: 'a', text: 'certa' },
              { id: 'b', text: 'errada' },
            ],
            correctOptionIds: ['a'],
            shuffle: false,
          } as Prisma.InputJsonValue,
          explanation: 'Simulada.',
          cefrLevel:
            LEVELS[Math.min(4, Math.max(0, Math.round(difficulty) + 2))] ??
            'B1',
          difficulty,
          status: ContentStatus.PUBLISHED,
          skills: {
            create: { skillId: `sim.${competency.toLowerCase()}`, position: 0 },
          },
        },
      });
      difficulties.set(item.id, difficulty);
    }

    return difficulties;
  }

  // -------------------------------------------------------------------------

  it('aluno B1 simulado termina o nivelamento em B1 ± 1 faixa, em até 30 itens', async () => {
    const difficulties = await syntheticBank();
    const { token, userId } = await signup('aluno@exemplo.com');
    const auth = { Authorization: `Bearer ${token}` };
    const random = seeded(2026);
    const trueTheta = 0;

    let state = await http().post('/placement/start').set(auth).expect(200);
    const testId = state.body.id as string;
    let answered = 0;

    while (state.body.result === null) {
      const item = state.body.next as {
        id: string;
        content: Record<string, unknown>;
      };

      // A questão chega sem gabarito, e a resposta não diz se acertou.
      expect(item.content).not.toHaveProperty('correctOptionIds');

      const difficulty = difficulties.get(item.id) ?? 0;
      const correct = random() < 1 / (1 + Math.exp(-(trueTheta - difficulty)));

      state = await http()
        .post(`/placement/${testId}/answer`)
        .set(auth)
        .send({
          itemId: item.id,
          response: { optionIds: [correct ? 'a' : 'b'] },
          responseTimeMs: 5_000,
        })
        .expect(200);

      expect(state.body).not.toHaveProperty('isCorrect');
      answered += 1;
      expect(answered).toBeLessThanOrEqual(30);
    }

    const level = state.body.result.overallLevel as (typeof LEVELS)[number];

    expect(['A2', 'B1', 'B2']).toContain(level);
    expect(state.body.result.competencies).toHaveLength(4);
    expect(state.body.result.note).toBeNull();

    // --- evento, histórico e respostas ---

    const completed = events.filter(
      (event) => event.name === 'placement.completed',
    );
    expect(completed).toHaveLength(1);
    expect(completed[0]?.payload).toMatchObject({
      placementId: testId,
      overallLevel: level,
      itemsAnswered: answered,
      bankExhausted: false,
    });

    expect(
      await context.prisma.answer.count({
        where: { userId, context: 'PLACEMENT' },
      }),
    ).toBe(answered);

    const latest = await http().get('/placement/latest').set(auth).expect(200);
    expect(latest.body.result).toMatchObject({ overallLevel: level });
    expect(latest.body.result.nextAvailableAt).toEqual(expect.any(String));

    // --- refazer antes de 60 dias ---

    const tooSoon = await http().post('/placement/start').set(auth).expect(409);
    expect(tooSoon.body.error.code).toBe('PLACEMENT_TOO_SOON');
    expect(tooSoon.body.error.details.nextAvailableAt).toEqual(
      expect.any(String),
    );

    // --- o learner-model parte do nivelamento ---

    const prior = await waitFor(
      () =>
        context.prisma.learnerPlacementPrior.findUnique({ where: { userId } }),
      'o ponto de partida do nivelamento',
    );
    expect(prior.placementId).toBe(testId);

    const profile = await http()
      .get('/me/learner-profile')
      .set(auth)
      .expect(200);
    expect(profile.body.overallLevel.note).toBe(
      'Calculado a partir das suas respostas.',
    );
  });

  it('checkpoint da unidade seed: tudo errado pede reforço', async () => {
    await curriculumSeed.run(context.prisma);
    const { token } = await signup('aluno@exemplo.com');
    const auth = { Authorization: `Bearer ${token}` };
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

    while (state.body.result === null) {
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
      expect(answered).toBeLessThanOrEqual(15);
    }

    expect(answered).toBeGreaterThanOrEqual(10);
    expect(state.body.result.result).toBe('NEEDS_REINFORCEMENT');
    expect(state.body.result.score).toBe(0);
    expect(state.body.result.reinforce.length).toBeGreaterThan(0);
    expect(state.body.result.message).toContain('escolha é sua');

    const completed = events.filter(
      (event) => event.name === 'checkpoint.completed',
    );
    expect(completed[0]?.payload).toMatchObject({
      checkpointId,
      unitId: unit.id,
      result: 'NEEDS_REINFORCEMENT',
      itemsAnswered: answered,
    });

    // Diagnóstico, não trava: dá para começar outro na hora.
    await http().post(`/checkpoints/${unit.id}/start`).set(auth).expect(200);
  });

  it('calibração: move a dificuldade no máximo 0.5 e marca item fácil demais', async () => {
    await context.prisma.skill.create({
      data: {
        id: 'sim.grammar',
        type: 'GRAMMAR',
        competency: 'GRAMMAR',
        cefrLevel: 'B1',
        title: 'Simulada',
      },
    });
    const item = await context.prisma.item.create({
      data: {
        type: 'MULTIPLE_CHOICE',
        prompt: 'Fácil demais',
        content: {
          options: [
            { id: 'a', text: 'certa' },
            { id: 'b', text: 'errada' },
          ],
          correctOptionIds: ['a'],
          shuffle: false,
        } as Prisma.InputJsonValue,
        explanation: 'Simulada.',
        cefrLevel: 'B1',
        difficulty: 0,
        exposureCount: 60,
        status: ContentStatus.PUBLISHED,
        skills: { create: { skillId: 'sim.grammar', position: 0 } },
      },
    });

    // 60 alunos, 59 acertos: 98%.
    for (let index = 0; index < 60; index += 1) {
      const user = await context.prisma.user.create({
        data: { email: `cal${String(index)}@exemplo.com`, name: 'Cal' },
      });
      await context.prisma.answer.create({
        data: {
          userId: user.id,
          itemId: item.id,
          context: 'REVIEW',
          response: { optionIds: ['a'] },
          isCorrect: index !== 0,
          score: index !== 0 ? 1 : 0,
          responseTimeMs: 3_000,
          detectedErrorPatterns: [],
          isFirstTry: true,
        },
      });
    }

    expect(await calibration.run()).toEqual({ calibrated: 1, flagged: 1 });

    const updated = await context.prisma.item.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(updated.difficulty).toBeLessThan(0);
    expect(updated.difficulty).toBeGreaterThanOrEqual(-0.5);

    const auth = { Authorization: `Bearer ${await editorToken()}` };
    const flagged = await http()
      .get('/admin/assessment/flagged-items')
      .set(auth)
      .expect(200);
    expect(flagged.body.data).toEqual([
      expect.objectContaining({
        itemId: item.id,
        flags: ['TOO_EASY'],
        responses: 60,
      }),
    ]);

    await http()
      .post(`/admin/assessment/flagged-items/${item.id}/resolve`)
      .set(auth)
      .expect(200, { resolved: 1 });
    const after = await http()
      .get('/admin/assessment/flagged-items')
      .set(auth)
      .expect(200);
    expect(after.body.data).toEqual([]);
  });
});

/** Uma resposta com o formato certo e o conteúdo errado, por tipo. */
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
