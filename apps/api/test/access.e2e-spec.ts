import { getQueueToken } from '@nestjs/bullmq';
import { ContentStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import { QUEUES } from 'src/infra/queue/queues';
import { EntitlementsService } from 'src/modules/billing/services/entitlements.service';
import { FAKE_WEBHOOK_TOKEN } from 'src/modules/billing/services/fake-payment-gateway.service';

import { billingSeed } from '../prisma/seeds/billing.seed';
import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';
const LESSON_SLUG = 'nice-to-meet-you';

/**
 * Acesso por plano com a política de verdade (a do billing, ligada no
 * AppModule pelo token `ACCESS_POLICY`).
 *
 * O seed tem uma unidade só no A1. Para ter "unidade 2", o teste publica uma
 * unidade vazia **antes** dela no nível — a do seed passa a ser a segunda,
 * sem precisar escrever uma lição inteira.
 */
describe('Acesso por plano (e2e)', () => {
  let context: TestApp;
  let billingQueue: Queue;
  let entitlements: EntitlementsService;

  beforeAll(async () => {
    context = await createTestApp({ accessPolicy: 'real' });
    billingQueue = context.app.get<Queue>(getQueueToken(QUEUES.BILLING));
    entitlements = context.app.get(EntitlementsService);
  });

  beforeEach(async () => {
    await drainQueue(billingQueue);
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.resetRateLimit();
    await curriculumSeed.run(context.prisma);
    await billingSeed.run(context.prisma);
  });

  afterAll(async () => {
    await drainQueue(billingQueue);
    await billingQueue?.obliterate({ force: true });
    await context?.close();
  });

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

  async function waitFor<T>(
    read: () => Promise<T | null>,
    what: string,
    timeoutMs = 15_000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const value = await read();

      if (value !== null) {
        return value;
      }

      if (Date.now() > deadline) {
        throw new Error(`Tempo esgotado esperando: ${what}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const http = () => request(context.app.getHttpServer());

  async function student(email = 'aluno@exemplo.com') {
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

    return {
      userId: signup.body.user.id as string,
      auth: { Authorization: `Bearer ${signup.body.accessToken as string}` },
    };
  }

  async function seedLesson() {
    return context.prisma.lesson.findUniqueOrThrow({
      where: { slug: LESSON_SLUG },
      select: { id: true, unitId: true, unit: { select: { levelId: true } } },
    });
  }

  /** Publica uma unidade vazia na frente: a do seed vira a segunda do nível. */
  async function pushSeedUnitToSecond(): Promise<string> {
    const lesson = await seedLesson();
    const unit = await context.prisma.unit.create({
      data: {
        levelId: lesson.unit.levelId,
        slug: 'a1-u0-warm-up',
        title: 'Aquecimento',
        order: -1,
        status: ContentStatus.PUBLISHED,
      },
    });
    return unit.id;
  }

  async function subscribe(
    userId: string,
    tier: 'BASE' | 'PLUS',
    status: 'ACTIVE' | 'EXPIRED',
  ) {
    const plan = await context.prisma.subscriptionPlan.findFirstOrThrow({
      where: { tier, billingPeriod: 'MONTHLY' },
    });
    await context.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        tier,
        billingPeriod: 'MONTHLY',
        priceCents: plan.priceCents,
        paymentMethod: 'PIX',
        status,
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      },
    });
    // Escrita direta no banco não passa pelos eventos de assinatura.
    await entitlements.invalidate(userId);
  }

  async function publishWorkbook(unitId: string): Promise<string> {
    const asset = await context.prisma.mediaAsset.create({
      data: {
        kind: 'PDF',
        storageKey: `content/workbooks/${unitId}.pdf`,
        mimeType: 'application/pdf',
      },
    });
    const workbook = await context.prisma.workbook.create({
      data: {
        unitId,
        slug: `workbook-${unitId}`,
        title: 'Apostila',
        order: 0,
        status: ContentStatus.PUBLISHED,
        assetId: asset.id,
      },
    });
    return workbook.id;
  }

  it('FREE abre a unidade 1 e recebe 403 PLAN_REQUIRED na unidade 2', async () => {
    const { auth } = await student();
    const lesson = await seedLesson();

    // Unidade do seed ainda é a primeira do A1: FREE abre e começa.
    await http().get(`/catalog/lessons/${LESSON_SLUG}`).set(auth).expect(200);
    const started = await http()
      .post(`/lessons/${lesson.id}/attempts`)
      .set(auth)
      .send({})
      .expect(201);
    const item = await context.prisma.item.findFirstOrThrow({
      where: { slug: 'a1-be-i-am-maya' },
    });

    await pushSeedUnitToSecond();

    const blocked = await http()
      .get(`/catalog/lessons/${LESSON_SLUG}`)
      .set(auth)
      .expect(403);
    expect(blocked.body.error).toMatchObject({
      code: 'PLAN_REQUIRED',
      details: { requiredPlan: 'BASE' },
    });
    expect(blocked.body.assets).toBeUndefined();

    const attempt = await http()
      .post(`/lessons/${lesson.id}/attempts`)
      .set(auth)
      .send({})
      .expect(403);
    expect(attempt.body.error.code).toBe('PLAN_REQUIRED');

    // Tentativa aberta antes da trava: responder em contexto LESSON também barra.
    const answer = await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: item.id,
        attemptId: started.body.id as string,
        context: 'LESSON',
        response: { optionIds: ['am'] },
        responseTimeMs: 3_000,
      })
      .expect(403);
    expect(answer.body.error.code).toBe('PLAN_REQUIRED');
  });

  it('listagem do FREE não esconde nada: diz locked e requiredPlan', async () => {
    const { auth } = await student();
    const lesson = await seedLesson();
    const warmUpId = await pushSeedUnitToSecond();
    await publishWorkbook(lesson.unitId);

    const units = await http()
      .get('/catalog/units?level=A1')
      .set(auth)
      .expect(200);
    const byId = new Map(
      (
        units.body.data as {
          id: string;
          locked: boolean;
          requiredPlan: string | null;
          lessons: { locked: boolean }[];
        }[]
      ).map((unit) => [unit.id, unit]),
    );

    expect(byId.get(warmUpId)).toMatchObject({
      locked: false,
      requiredPlan: null,
    });
    expect(byId.get(lesson.unitId)).toMatchObject({
      locked: true,
      requiredPlan: 'BASE',
    });
    expect(byId.get(lesson.unitId)?.lessons[0]).toMatchObject({ locked: true });

    const unit = await http()
      .get('/catalog/units/a1-u1-new-neighbors')
      .set(auth)
      .expect(200);
    expect(unit.body).toMatchObject({ locked: true, requiredPlan: 'BASE' });

    // Apostila em PDF é dos planos pagos, mesmo na unidade 1.
    const workbooks = await http()
      .get('/catalog/workbooks')
      .set(auth)
      .expect(200);
    expect(workbooks.body[0]).toMatchObject({
      locked: true,
      requiredPlan: 'BASE',
      file: null,
    });
    const file = await http()
      .get(`/catalog/workbooks/${workbooks.body[0].id as string}/file`)
      .set(auth)
      .expect(403);
    expect(file.body.error.code).toBe('PLAN_REQUIRED');
  });

  it('BASE abre tudo, apostila inclusive', async () => {
    const { userId, auth } = await student();
    const lesson = await seedLesson();
    await pushSeedUnitToSecond();
    const workbookId = await publishWorkbook(lesson.unitId);
    await subscribe(userId, 'BASE', 'ACTIVE');

    await http().get(`/catalog/lessons/${LESSON_SLUG}`).set(auth).expect(200);
    await http()
      .post(`/lessons/${lesson.id}/attempts`)
      .set(auth)
      .send({})
      .expect(201);

    const units = await http()
      .get('/catalog/units?level=A1')
      .set(auth)
      .expect(200);
    expect(
      (units.body.data as { locked: boolean }[]).every((unit) => !unit.locked),
    ).toBe(true);

    const file = await http()
      .get(`/catalog/workbooks/${workbookId}/file`)
      .set(auth)
      .expect(200);
    expect(file.body.file.url).toEqual(expect.any(String));
  });

  it('assinatura vencida bloqueia lição nova, mas a revisão continua', async () => {
    const { userId, auth } = await student();
    const lesson = await seedLesson();
    await pushSeedUnitToSecond();
    await subscribe(userId, 'BASE', 'EXPIRED');

    await http().get(`/catalog/lessons/${LESSON_SLUG}`).set(auth).expect(403);
    await http()
      .post(`/lessons/${lesson.id}/attempts`)
      .set(auth)
      .send({})
      .expect(403);

    // Conteúdo estudado antes do vencimento: o card de revisão existe.
    await context.prisma.reviewCard.create({
      data: {
        userId,
        kind: 'ERROR_PATTERN',
        refId: 'l1.have-for-age',
        source: 'LESSON',
        due: new Date(Date.now() - 60_000),
        stability: 1,
        difficulty: 5,
      },
    });

    const session = await http()
      .get('/reviews/session?minutes=5')
      .set(auth)
      .expect(200);
    const card = (session.body as { cardId: string; kind: string }[]).find(
      (entry) => entry.kind === 'ERROR_PATTERN',
    );
    expect(card).toBeDefined();

    await http()
      .post(`/reviews/${card?.cardId ?? ''}/answer`)
      .set(auth)
      .send({ kind: 'SELF_RATING', selfRating: 'GOOD' })
      .expect(200);

    // E a questão respondida em contexto REVIEW não passa pela trava.
    const item = await context.prisma.item.findFirstOrThrow({
      where: { slug: 'a1-be-i-am-maya' },
    });
    await http()
      .post('/answers')
      .set(auth)
      .send({
        itemId: item.id,
        context: 'REVIEW',
        response: { optionIds: ['am'] },
        responseTimeMs: 3_000,
      })
      .expect(201);
  });

  it('assinar pelo webhook destrava na hora — o cache do plano é invalidado', async () => {
    const { auth } = await student();
    await pushSeedUnitToSecond();

    await http().get(`/catalog/lessons/${LESSON_SLUG}`).set(auth).expect(403);

    const checkout = await http()
      .post('/billing/checkout')
      .set(auth)
      .send({ tier: 'BASE', billingPeriod: 'MONTHLY', paymentMethod: 'PIX' })
      .expect(202);
    const pending = await waitFor(async () => {
      const row = await context.prisma.subscription.findUnique({
        where: { id: checkout.body.subscription.id as string },
      });
      return row?.asaasSubscriptionId ?? null;
    }, 'assinatura no gateway');

    await http()
      .post('/webhooks/asaas')
      .set('asaas-access-token', FAKE_WEBHOOK_TOKEN)
      .send({
        id: `evt_access_${String(Date.now())}`,
        event: 'PAYMENT_RECEIVED',
        payment: {
          subscription: pending,
          dueDate: new Date().toISOString().slice(0, 10),
        },
      })
      .expect(200);

    await waitFor(async () => {
      const res = await http().get(`/catalog/lessons/${LESSON_SLUG}`).set(auth);
      return res.status === 200 ? true : null;
    }, 'lição liberada depois da ativação');
  });
});

describe('Acesso sem política ligada (e2e)', () => {
  let context: TestApp;

  beforeAll(async () => {
    context = await createTestApp({ accessPolicy: 'none' });
  });

  afterAll(async () => {
    await context?.close();
  });

  it('nega tudo — falha fechada', async () => {
    await curriculumSeed.run(context.prisma);
    const signup = await request(context.app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Aluno',
        email: 'sem-politica@exemplo.com',
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);

    const res = await request(context.app.getHttpServer())
      .get(`/catalog/lessons/${LESSON_SLUG}`)
      .set('Authorization', `Bearer ${signup.body.accessToken as string}`)
      .expect(403);

    expect(res.body.error.code).toBe('PLAN_REQUIRED');
  });
});
