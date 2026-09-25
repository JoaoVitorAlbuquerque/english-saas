import { getQueueToken } from '@nestjs/bullmq';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import { RequiresFeature } from 'src/common/decorators/requires-feature.decorator';
import { QUEUES } from 'src/infra/queue/queues';
import { InsufficientCreditsError } from 'src/modules/billing/billing.errors';
import { RequiresFeatureGuard } from 'src/modules/billing/guards/requires-feature.guard';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';
import { EntitlementsService } from 'src/modules/billing/services/entitlements.service';
import {
  FAKE_WEBHOOK_TOKEN,
  FakePaymentGateway,
} from 'src/modules/billing/services/fake-payment-gateway.service';
import { SubscriptionService } from 'src/modules/billing/services/subscription.service';

import { billingSeed } from '../prisma/seeds/billing.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

/**
 * Módulo 11: assinatura pelo gateway fake, que entende o mesmo webhook do
 * Asaas. O critério de pronto de ponta a ponta: assina o PLUS, recebe os
 * créditos, consome, cancela — e o acesso fica até o fim do período pago.
 */
describe('Billing (e2e)', () => {
  let context: TestApp;
  let billingQueue: Queue;
  let gateway: FakePaymentGateway;
  let credits: AiCreditService;
  let entitlements: EntitlementsService;
  let subscriptions: SubscriptionService;

  beforeAll(async () => {
    context = await createTestApp();
    billingQueue = context.app.get<Queue>(getQueueToken(QUEUES.BILLING));
    gateway = context.app.get(FakePaymentGateway);
    credits = context.app.get(AiCreditService);
    entitlements = context.app.get(EntitlementsService);
    subscriptions = context.app.get(SubscriptionService);
  });

  beforeEach(async () => {
    await drainQueue(billingQueue);
    await context.resetDatabase();
    await context.resetRateLimit();
    await billingSeed.run(context.prisma);
  });

  /** Não deixa o `close()` truncar em cima de um job vivo (ver srs/planner). */
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
    await drainQueue(billingQueue);
    await billingQueue?.obliterate({ force: true });
    await context?.close();
  });

  const http = () => request(context.app.getHttpServer());

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

  async function student(
    email = 'aluno@exemplo.com',
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

    return {
      userId: signup.body.user.id as string,
      auth: { Authorization: `Bearer ${signup.body.accessToken as string}` },
    };
  }

  async function freeCredited(auth: Record<string, string>): Promise<void> {
    await waitFor(async () => {
      const res = await http().get('/me/credits').set(auth).expect(200);
      return res.body.balance === 10 ? true : null;
    }, 'crédito do FREE na criação da conta');
  }

  function webhook(body: unknown, token = FAKE_WEBHOOK_TOKEN) {
    return http()
      .post('/webhooks/asaas')
      .set('asaas-access-token', token)
      .send(body as object);
  }

  /** Checkout do PLUS até o link de pagamento existir. */
  async function checkoutPlus(auth: Record<string, string>) {
    const res = await http()
      .post('/billing/checkout')
      .set(auth)
      .send({
        tier: 'PLUS',
        billingPeriod: 'MONTHLY',
        paymentMethod: 'PIX',
        cpfCnpj: '12345678909',
      })
      .expect(202);

    expect(res.body.subscription).toMatchObject({
      status: 'PENDING',
      priceLabel: 'R$ 69,90 por mês',
    });

    return waitFor(async () => {
      const row = await context.prisma.subscription.findUnique({
        where: { id: res.body.subscription.id as string },
      });
      return row?.checkoutUrl != null && row.asaasSubscriptionId !== null
        ? { ...row, asaasSubscriptionId: row.asaasSubscriptionId }
        : null;
    }, 'link de pagamento do checkout');
  }

  // O Redis não é zerado entre testes: id repetido cairia no dedup do
  // `jobId` de um job de outro teste. O Asaas nunca repete id.
  let eventSeq = 0;

  function paidEvent(
    asaasSubscriptionId: string,
    eventId = `evt_paid_${String(Date.now())}_${String(++eventSeq)}`,
  ) {
    return {
      id: eventId,
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: `pay_${eventId}`,
        subscription: asaasSubscriptionId,
        dueDate: new Date().toISOString().slice(0, 10),
      },
    };
  }

  it('lista os planos com o preço por extenso, sem precisar de login', async () => {
    const res = await http().get('/plans').expect(200);

    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toMatchObject({ tier: 'FREE', priceLabel: 'Grátis' });
    expect(res.body).toContainEqual(
      expect.objectContaining({
        tier: 'PLUS',
        billingPeriod: 'YEARLY',
        priceLabel: 'R$ 699,00 por ano (equivale a R$ 58,25 por mês)',
      }),
    );
  });

  it('assina o PLUS, recebe créditos, consome, cancela e mantém o acesso até o fim do período', async () => {
    const { userId, auth } = await student();
    await freeCredited(auth);

    const pending = await checkoutPlus(auth);
    const me = await http().get('/me/subscription').set(auth).expect(200);
    expect(me.body).toMatchObject({
      tier: 'FREE',
      subscription: { status: 'PENDING', checkoutUrl: pending.checkoutUrl },
    });
    expect(
      gateway.subscriptions.get(pending.asaasSubscriptionId),
    ).toMatchObject({
      priceCents: 6_990,
      cycle: 'MONTHLY',
      paymentMethod: 'PIX',
    });

    // O Asaas avisa que o Pix caiu.
    await webhook(paidEvent(pending.asaasSubscriptionId)).expect(200);

    const active = await waitFor(async () => {
      const res = await http().get('/me/subscription').set(auth).expect(200);
      return res.body.subscription.status === 'ACTIVE' ? res.body : null;
    }, 'assinatura ativa');
    expect(active.tier).toBe('PLUS');

    // Repõe até a cota do PLUS: tinha 10 do FREE, fica com 500.
    const afterGrant = await http().get('/me/credits').set(auth).expect(200);
    expect(afterGrant.body).toMatchObject({
      tier: 'PLUS',
      balance: 500,
      monthlyAiCredits: 500,
    });
    expect(await entitlements.can(userId, 'GENERATOR_TOPIC')).toBe(true);

    // Consome: material por tema custa 5.
    await credits.spend(userId, 'GENERATOR_TOPIC', async () => 'material');
    expect(await credits.balanceFor(userId)).toBe(495);

    // A IA falhou: o crédito volta.
    await expect(
      credits.spend(userId, 'TUTOR_ROLEPLAY', async () => {
        throw new Error('IA fora do ar');
      }),
    ).rejects.toThrow('IA fora do ar');
    expect(await credits.balanceFor(userId)).toBe(495);

    // Cancela em um clique.
    const canceled = await http().post('/billing/cancel').set(auth).expect(200);
    expect(canceled.body).toMatchObject({
      tier: 'PLUS',
      subscription: { status: 'CANCELED' },
    });
    expect(canceled.body.subscription.accessUntil).toBe(
      active.subscription.currentPeriodEnd,
    );
    expect(canceled.body.message).toContain('nada mais será cobrado');

    await waitFor(
      async () =>
        gateway.canceled.has(pending.asaasSubscriptionId) ? true : null,
      'cancelamento no gateway',
    );

    // Dentro do período ainda é PLUS; passado o fim, cai pro FREE sozinho.
    const periodEnd = new Date(active.subscription.currentPeriodEnd as string);
    expect((await entitlements.currentPlan(userId)).tier).toBe('PLUS');
    expect(
      (
        await entitlements.currentPlan(
          userId,
          new Date(periodEnd.getTime() + 1),
        )
      ).tier,
    ).toBe('FREE');
  });

  it('o mesmo webhook entregue duas vezes só credita uma', async () => {
    const { userId, auth } = await student();
    await freeCredited(auth);
    const pending = await checkoutPlus(auth);
    const dupId = `evt_dup_${String(Date.now())}`;

    await webhook(paidEvent(pending.asaasSubscriptionId, dupId)).expect(200);
    await waitFor(async () => {
      const row = await context.prisma.subscription.findUnique({
        where: { id: pending.id },
      });
      return row?.status === 'ACTIVE' ? true : null;
    }, 'primeira entrega aplicada');

    // Reentrega igual pelo HTTP, e a mesma aplicada direto, sem a fila no
    // meio — quem segura é o unique de `asaas_webhook_events`.
    await webhook(paidEvent(pending.asaasSubscriptionId, dupId)).expect(200);
    await drainQueue(billingQueue);
    await expect(
      subscriptions.applyWebhook({
        externalEventId: dupId,
        rawType: 'PAYMENT_RECEIVED',
        kind: 'PAYMENT_PAID',
        externalSubscriptionId: pending.asaasSubscriptionId,
        paymentDueDate: new Date().toISOString(),
        payload: {},
      }),
    ).resolves.toEqual({ status: 'DUPLICATE' });

    const grants = await context.prisma.aiCreditLedgerEntry.findMany({
      where: { userId, kind: 'GRANT' },
    });
    expect(grants.map((g) => g.cycleKey).sort()).toEqual([
      expect.stringMatching(/^FREE:/),
      expect.stringMatching(/^PLUS:/),
    ]);
    expect(await context.prisma.asaasWebhookEvent.count()).toBe(1);
    expect(await credits.balanceFor(userId)).toBe(500);
  });

  it('recusa webhook sem o token combinado ou com corpo que não é webhook', async () => {
    const res = await webhook(
      { id: 'evt_x', event: 'PAYMENT_RECEIVED' },
      'errado',
    ).expect(401);
    expect(res.body.error.code).toBe('INVALID_WEBHOOK_TOKEN');

    await webhook({ nada: 'aqui' }).expect(400);
    expect(await billingQueue.getJobCounts('waiting', 'active')).toMatchObject({
      waiting: 0,
    });
  });

  it('estorno é idempotente e duas reservas simultâneas não gastam o mesmo crédito', async () => {
    const { userId, auth } = await student();
    await freeCredited(auth);

    // 10 créditos, roleplay custa 3: cabem exatamente três.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        credits.reserve(userId, 'TUTOR_ROLEPLAY'),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');

    expect(ok).toHaveLength(3);
    expect(refused).toHaveLength(2);
    expect((refused[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InsufficientCreditsError,
    );
    expect(await credits.balanceFor(userId)).toBe(1);

    const first = (ok[0] as PromiseFulfilledResult<{ reservationId: string }>)
      .value;
    expect(await credits.refund(first.reservationId)).toBe(true);
    expect(await credits.refund(first.reservationId)).toBe(false);
    expect(await credits.balanceFor(userId)).toBe(4);

    const quota = await entitlements.getQuota(userId, 'TUTOR_ROLEPLAY');
    expect(quota).toMatchObject({
      tier: 'FREE',
      allowed: true,
      remainingUses: 1,
    });
  });

  it('uma assinatura em aberto por vez; cancelar sem assinatura é 404', async () => {
    const { auth } = await student();

    await http().post('/billing/cancel').set(auth).expect(404);

    const pending = await checkoutPlus(auth);
    await webhook(paidEvent(pending.asaasSubscriptionId)).expect(200);
    await waitFor(async () => {
      const res = await http().get('/me/subscription').set(auth).expect(200);
      return res.body.subscription.status === 'ACTIVE' ? true : null;
    }, 'assinatura ativa');

    const again = await http()
      .post('/billing/checkout')
      .set(auth)
      .send({ tier: 'BASE', billingPeriod: 'YEARLY', paymentMethod: 'BOLETO' })
      .expect(409);
    expect(again.body.error.code).toBe('ALREADY_SUBSCRIBED');
  });

  it('o guard barra o gerador no FREE e libera no PLUS', async () => {
    const { userId } = await student();

    class Target {
      @RequiresFeature('GENERATOR_TOPIC')
      handler(): void {}
    }

    const guard = new RequiresFeatureGuard(new Reflector(), entitlements);
    const contextFor = (id: string) =>
      ({
        getType: () => 'http',
        getHandler: () => Target.prototype.handler,
        getClass: () => Target,
        switchToHttp: () => ({ getRequest: () => ({ user: { id } }) }),
      }) as unknown as ExecutionContext;

    await expect(guard.canActivate(contextFor(userId))).rejects.toMatchObject({
      code: 'FEATURE_NOT_AVAILABLE',
    });

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
        paymentMethod: 'CREDIT_CARD',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      },
    });
    // Escrita direta no banco não emite evento de assinatura: derruba o
    // plano em cache à mão (em produção quem faz isso é o listener).
    await entitlements.invalidate(userId);

    await expect(guard.canActivate(contextFor(userId))).resolves.toBe(true);
  });

  it('admin edita o preço; quem já assinou continua com o preço da época', async () => {
    const { auth } = await student('aluno@exemplo.com');
    const pending = await checkoutPlus(auth);

    const admin = await student('admin@exemplo.com');
    await context.prisma.user.update({
      where: { id: admin.userId },
      data: { role: Role.ADMIN },
    });
    const signin = await http()
      .post('/auth/signin')
      .send({ email: 'admin@exemplo.com', password: PASSWORD })
      .expect(200);
    const adminAuth = {
      Authorization: `Bearer ${signin.body.accessToken as string}`,
    };

    await http()
      .patch(`/admin/billing/plans/${pending.planId}`)
      .set(auth)
      .send({ priceCents: 7_990 })
      .expect(403);

    const updated = await http()
      .patch(`/admin/billing/plans/${pending.planId}`)
      .set(adminAuth)
      .send({ priceCents: 7_990 })
      .expect(200);
    expect(updated.body.priceLabel).toBe('R$ 79,90 por mês');

    const me = await http().get('/me/subscription').set(auth).expect(200);
    expect(me.body.subscription.priceCents).toBe(6_990);
  });

  it('o CPF vai direto para o gateway e nunca entra nos dados do job', async () => {
    const { auth } = await student();
    const pending = await checkoutPlus(auth);

    const job = await billingQueue.getJob(`checkout-${pending.id}`);
    expect(job?.data).toEqual({ subscriptionId: pending.id });
    expect(JSON.stringify(job?.data)).not.toContain('12345678909');
    expect(
      [...gateway.customers.values()].some((c) => c.cpfCnpj === '12345678909'),
    ).toBe(true);
  });

  it('upgrade BASE → PLUS com desconto do que sobrou, sem cancelar antes', async () => {
    const { userId, auth } = await student();
    await waitFor(
      async () => ((await credits.balanceFor(userId)) === 10 ? true : null),
      'crédito do FREE',
    );

    // Assina e paga o BASE.
    const base = await http()
      .post('/billing/checkout')
      .set(auth)
      .send({
        tier: 'BASE',
        billingPeriod: 'MONTHLY',
        paymentMethod: 'PIX',
        cpfCnpj: '12345678909',
      })
      .expect(202);
    const baseRow = await waitFor(async () => {
      const row = await context.prisma.subscription.findUnique({
        where: { id: base.body.subscription.id as string },
      });
      return row?.asaasSubscriptionId != null ? row : null;
    }, 'BASE no gateway');
    await webhook(paidEvent(baseRow.asaasSubscriptionId ?? '')).expect(200);
    await waitFor(async () => {
      const row = await context.prisma.subscription.findUnique({
        where: { id: baseRow.id },
      });
      return row?.status === 'ACTIVE' ? true : null;
    }, 'BASE ativo');

    // Upgrade: não é 409, e a 1ª cobrança do PLUS vem com o crédito do BASE.
    const upgrade = await http()
      .post('/billing/checkout')
      .set(auth)
      .send({ tier: 'PLUS', billingPeriod: 'MONTHLY', paymentMethod: 'PIX' })
      .expect(202);
    const plusRow = await waitFor(async () => {
      const row = await context.prisma.subscription.findUnique({
        where: { id: upgrade.body.subscription.id as string },
      });
      return row?.asaasSubscriptionId != null ? row : null;
    }, 'PLUS no gateway');

    expect(plusRow.upgradesFromId).toBe(baseRow.id);
    // Acabou de pagar o mês do BASE (o período conta da meia-noite UTC do
    // vencimento): no máximo um dia usado, o resto vira desconto.
    expect(plusRow.firstPaymentDiscountCents).toBeGreaterThan(
      Math.floor((3_990 * 29) / 30),
    );
    expect(plusRow.firstPaymentDiscountCents).toBeLessThanOrEqual(3_990);
    expect(
      gateway.subscriptions.get(plusRow.asaasSubscriptionId ?? '')
        ?.firstPaymentDiscountCents,
    ).toBe(plusRow.firstPaymentDiscountCents);

    // Até pagar, continua BASE.
    const meantime = await http().get('/me/subscription').set(auth).expect(200);
    expect(meantime.body.tier).toBe('BASE');

    await webhook(paidEvent(plusRow.asaasSubscriptionId ?? '')).expect(200);

    await waitFor(async () => {
      const row = await context.prisma.subscription.findUnique({
        where: { id: plusRow.id },
      });
      return row?.status === 'ACTIVE' ? true : null;
    }, 'PLUS ativo');
    const done = await http().get('/me/subscription').set(auth).expect(200);
    expect(done.body).toMatchObject({
      tier: 'PLUS',
      subscription: { status: 'ACTIVE' },
    });

    const oldBase = await context.prisma.subscription.findUniqueOrThrow({
      where: { id: baseRow.id },
    });
    expect(oldBase.status).toBe('CANCELED');
    await waitFor(
      async () =>
        gateway.canceled.has(baseRow.asaasSubscriptionId ?? '') ? true : null,
      'BASE cancelado no gateway',
    );
    expect(await credits.balanceFor(userId)).toBe(500);

    // Descer de plano ainda não existe.
    const down = await http()
      .post('/billing/checkout')
      .set(auth)
      .send({ tier: 'BASE', billingPeriod: 'MONTHLY', paymentMethod: 'PIX' })
      .expect(409);
    expect(down.body.error.code).toBe('ALREADY_SUBSCRIBED');
  });
});
