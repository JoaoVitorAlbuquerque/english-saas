import { getQueueToken } from '@nestjs/bullmq';
import { Role } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';

import { QUEUES } from 'src/infra/queue/queues';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';

import { billingSeed } from '../prisma/seeds/billing.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';

type Account = { id: string; email: string; auth: Record<string, string> };

/**
 * Telas de gestão do admin: busca e ficha do aluno, plano, custo dos
 * créditos, bônus e o log de auditoria. O que importa provar: só ADMIN
 * entra, cada escrita deixa rastro **depois** de dar certo, e ação que
 * falha não deixa rastro.
 */
describe('Admin (e2e)', () => {
  let context: TestApp;
  let billingQueue: Queue;
  let credits: AiCreditService;

  beforeAll(async () => {
    context = await createTestApp();
    billingQueue = context.app.get<Queue>(getQueueToken(QUEUES.BILLING));
    credits = context.app.get(AiCreditService);
  });

  beforeEach(async () => {
    await drainQueue(billingQueue);
    await context.resetDatabase();
    await context.resetRateLimit();
    await billingSeed.run(context.prisma);
  });

  afterAll(async () => {
    await drainQueue(billingQueue);
    await billingQueue?.obliterate({ force: true });
    await context?.close();
  });

  const http = () => request(context.app.getHttpServer());

  /** O crédito do FREE nasce num job; não deixa o reset truncar em cima. */
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

  /** Cria a conta, ajusta o papel e entra de novo (o papel viaja no JWT). */
  async function account(
    email: string,
    name: string,
    role: Role = Role.STUDENT,
  ): Promise<Account> {
    const signup = await http()
      .post('/auth/signup')
      .send({
        name,
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);
    const id = signup.body.user.id as string;

    if (role !== Role.STUDENT) {
      await context.prisma.user.update({ where: { id }, data: { role } });
    }

    const signin = await http()
      .post('/auth/signin')
      .send({ email, password: PASSWORD })
      .expect(200);

    return {
      id,
      email,
      auth: { Authorization: `Bearer ${signin.body.accessToken as string}` },
    };
  }

  const admin = () => account('admin@exemplo.com', 'Admin Silva', Role.ADMIN);

  async function auditRows() {
    return context.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async function freeCredited(userId: string): Promise<void> {
    await waitFor(
      async () => ((await credits.balanceFor(userId)) === 10 ? true : null),
      'crédito do FREE na criação da conta',
    );
  }

  describe('acesso', () => {
    it('só ADMIN: aluno e editor levam 403, sem token leva 401', async () => {
      const student = await account('aluno@exemplo.com', 'Aluna Souza');
      const editor = await account(
        'editor@exemplo.com',
        'Edu Editor',
        Role.EDITOR,
      );
      const id = student.id;
      const routes = [
        '/admin/users?q=a',
        `/admin/users/${id}`,
        `/admin/users/${id}/progress`,
        `/admin/users/${id}/plan`,
        `/admin/users/${id}/history`,
        `/admin/users/${id}/subscription`,
        `/admin/users/${id}/credits`,
        `/admin/users/${id}/credits/history`,
        `/admin/users/${id}/ai-usage`,
        '/admin/audit-log',
        '/admin/billing/plans',
        '/admin/billing/credit-costs',
        '/admin/metrics',
      ];

      for (const route of routes) {
        await http().get(route).set(student.auth).expect(403);
        await http().get(route).set(editor.auth).expect(403);
        await http().get(route).expect(401);
      }

      await http()
        .post(`/admin/billing/users/${id}/credits/bonus`)
        .set(editor.auth)
        .send({ amount: 5, reason: 'teste' })
        .expect(403);
      await http()
        .patch('/admin/billing/credit-costs/TUTOR_ROLEPLAY')
        .set(editor.auth)
        .send({ cost: 4 })
        .expect(403);

      expect(await auditRows()).toEqual([]);
    });
  });

  describe('busca de alunos', () => {
    it('acha por nome ou por e-mail, sem diferença de caixa, do mais novo ao mais antigo', async () => {
      const boss = await admin();
      await account('ana.lima@exemplo.com', 'Ana Lima');
      await account('bruno@exemplo.com', 'Bruno ANA Costa');
      await account('carla@exemplo.com', 'Carla Dias');

      const byName = await http()
        .get('/admin/users?q=ana')
        .set(boss.auth)
        .expect(200);
      expect(
        byName.body.data.map((row: { email: string }) => row.email),
      ).toEqual(['bruno@exemplo.com', 'ana.lima@exemplo.com']);

      const byEmail = await http()
        .get('/admin/users?q=CARLA@')
        .set(boss.auth)
        .expect(200);
      expect(byEmail.body.data).toHaveLength(1);
      expect(byEmail.body.data[0]).toMatchObject({
        name: 'Carla Dias',
        role: 'STUDENT',
        deletedAt: null,
        anonymizedAt: null,
      });

      const all = await http()
        .get('/admin/users?limit=2')
        .set(boss.auth)
        .expect(200);
      expect(all.body.data.map((row: { email: string }) => row.email)).toEqual([
        'carla@exemplo.com',
        'bruno@exemplo.com',
      ]);
      expect(all.body.hasMore).toBe(true);

      const next = await http()
        .get(`/admin/users?limit=2&cursor=${all.body.nextCursor as string}`)
        .set(boss.auth)
        .expect(200);
      expect(next.body.data.map((row: { email: string }) => row.email)).toEqual(
        ['ana.lima@exemplo.com', 'admin@exemplo.com'],
      );
    });
  });

  describe('ficha do aluno', () => {
    it('abrir a ficha devolve conta e perfil e deixa rastro; id inexistente é 404 sem rastro', async () => {
      const boss = await admin();
      const student = await account('aluno@exemplo.com', 'Aluna Souza');

      const res = await http()
        .get(`/admin/users/${student.id}`)
        .set(boss.auth)
        .expect(200);
      expect(res.body.user).toMatchObject({
        id: student.id,
        email: 'aluno@exemplo.com',
        name: 'Aluna Souza',
        role: 'STUDENT',
      });
      expect(res.body.profile).toMatchObject({
        timezone: 'America/Sao_Paulo',
        goals: [],
      });
      expect(res.body.interests).toEqual([]);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: boss.id,
        actorEmail: 'admin@exemplo.com',
        action: 'student.view',
        targetType: 'user',
        targetId: student.id,
      });

      await http()
        .get('/admin/users/00000000-0000-4000-8000-000000000000')
        .set(boss.auth)
        .expect(404);
      await http().get('/admin/users/nao-e-uuid').set(boss.auth).expect(400);
      expect(await auditRows()).toHaveLength(1);
    });

    it('as seções leem os serviços donos: plano ausente é null, não erro', async () => {
      const boss = await admin();
      const student = await account('aluno@exemplo.com', 'Aluna Souza');
      await freeCredited(student.id);
      await context.prisma.aiUsage.create({
        data: {
          userId: student.id,
          feature: 'tutor-correction',
          promptId: 'tutor-correction',
          promptVersion: 1,
          model: 'fake',
          tier: 'SMART',
          inputTokens: 100,
          outputTokens: 50,
          costUsdMicros: 4_200,
          latencyMs: 300,
          status: 'OK',
        },
      });
      const base = `/admin/users/${student.id}`;

      const plan = await http().get(`${base}/plan`).set(boss.auth).expect(200);
      expect(plan.body).toEqual({ plan: null, pace: null });

      const history = await http()
        .get(`${base}/history`)
        .set(boss.auth)
        .expect(200);
      expect(history.body).toEqual({
        data: [],
        hasMore: false,
        nextCursor: null,
      });

      const progress = await http()
        .get(`${base}/progress?weeks=4`)
        .set(boss.auth)
        .expect(200);
      expect(progress.body.period.weeks).toBe(4);

      const subscription = await http()
        .get(`${base}/subscription`)
        .set(boss.auth)
        .expect(200);
      expect(subscription.body).toMatchObject({
        tier: 'FREE',
        subscription: null,
      });

      const balance = await http()
        .get(`${base}/credits`)
        .set(boss.auth)
        .expect(200);
      expect(balance.body).toMatchObject({
        tier: 'FREE',
        balance: 10,
        monthlyAiCredits: 10,
        costs: { TUTOR_CORRECTION: 1, TUTOR_ROLEPLAY: 3 },
      });

      const ledger = await http()
        .get(`${base}/credits/history`)
        .set(boss.auth)
        .expect(200);
      expect(ledger.body.data).toHaveLength(1);
      expect(ledger.body.data[0]).toMatchObject({ kind: 'GRANT', amount: 10 });

      const usage = await http()
        .get(`${base}/ai-usage`)
        .set(boss.auth)
        .expect(200);
      expect(usage.body.totals).toMatchObject({
        calls: 1,
        costUsdMicros: 4_200,
      });
      expect(usage.body.byFeature).toEqual([
        expect.objectContaining({ feature: 'tutor-correction', calls: 1 }),
      ]);

      // Só abrir a ficha (`GET :id`) é auditado; as seções não.
      expect(await auditRows()).toEqual([]);
    });
  });

  describe('conceder créditos', () => {
    it('soma ao saldo, guarda o motivo no extrato e registra quem fez', async () => {
      const boss = await admin();
      const student = await account('aluno@exemplo.com', 'Aluna Souza');
      await freeCredited(student.id);

      const res = await http()
        .post(`/admin/billing/users/${student.id}/credits/bonus`)
        .set(boss.auth)
        .send({ amount: 25, reason: '  Compensação pelo erro do roleplay  ' })
        .expect(201);
      expect(res.body).toEqual({ balance: 35 });

      const ledger = await http()
        .get(`/admin/users/${student.id}/credits/history`)
        .set(boss.auth)
        .expect(200);
      expect(ledger.body.data[0]).toMatchObject({
        kind: 'BONUS',
        amount: 25,
        reason: 'Compensação pelo erro do roleplay',
      });

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: boss.id,
        actorEmail: 'admin@exemplo.com',
        action: 'credits.bonus',
        targetType: 'user',
        targetId: student.id,
        details: {
          amount: 25,
          reason: 'Compensação pelo erro do roleplay',
          balanceAfter: 35,
        },
      });
    });

    it('sem motivo, fora do limite ou para aluno que não existe: recusa e não registra', async () => {
      const boss = await admin();
      const student = await account('aluno@exemplo.com', 'Aluna Souza');
      const url = `/admin/billing/users/${student.id}/credits/bonus`;

      await http()
        .post(url)
        .set(boss.auth)
        .send({ amount: 5, reason: '   ' })
        .expect(400);
      await http()
        .post(url)
        .set(boss.auth)
        .send({ amount: 0, reason: 'x' })
        .expect(400);
      await http()
        .post(url)
        .set(boss.auth)
        .send({ amount: 10_001, reason: 'x' })
        .expect(400);
      await http()
        .post(
          '/admin/billing/users/00000000-0000-4000-8000-000000000000/credits/bonus',
        )
        .set(boss.auth)
        .send({ amount: 5, reason: 'x' })
        .expect(404);

      expect(await auditRows()).toEqual([]);
    });
  });

  describe('planos', () => {
    it('grava só o que mudou, com antes e depois', async () => {
      const boss = await admin();
      const plans = await http()
        .get('/admin/billing/plans')
        .set(boss.auth)
        .expect(200);
      const plus = plans.body.find(
        (plan: { tier: string; billingPeriod: string | null }) =>
          plan.tier === 'PLUS' && plan.billingPeriod === 'MONTHLY',
      ) as { id: string; priceCents: number; monthlyAiCredits: number };

      await http()
        .patch(`/admin/billing/plans/${plus.id}`)
        .set(boss.auth)
        .send({
          priceCents: plus.priceCents + 1_000,
          monthlyAiCredits: plus.monthlyAiCredits,
        })
        .expect(200);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'plan.update',
        targetType: 'plan',
        targetId: plus.id,
        details: {
          tier: 'PLUS',
          billingPeriod: 'MONTHLY',
          changes: {
            priceCents: {
              from: plus.priceCents,
              to: plus.priceCents + 1_000,
            },
          },
        },
      });
      expect(
        (rows[0]?.details as { changes: Record<string, unknown> }).changes,
      ).not.toHaveProperty('monthlyAiCredits');
    });

    it('corpo vazio e plano inexistente são recusados sem rastro', async () => {
      const boss = await admin();
      const plans = await http()
        .get('/admin/billing/plans')
        .set(boss.auth)
        .expect(200);
      const first = plans.body[0] as { id: string };

      await http()
        .patch(`/admin/billing/plans/${first.id}`)
        .set(boss.auth)
        .send({})
        .expect(400);
      await http()
        .patch('/admin/billing/plans/00000000-0000-4000-8000-000000000000')
        .set(boss.auth)
        .send({ active: false })
        .expect(404);

      expect(await auditRows()).toEqual([]);
    });
  });

  describe('custo dos créditos', () => {
    it('lista o padrão e o valor novo vale na hora: reserva, saldo restante e GET /me/credits', async () => {
      const boss = await admin();
      const student = await account('aluno@exemplo.com', 'Aluna Souza');
      await freeCredited(student.id);

      const before = await http()
        .get('/admin/billing/credit-costs')
        .set(boss.auth)
        .expect(200);
      expect(before.body.costs).toEqual({
        TUTOR_CORRECTION: 1,
        TUTOR_ROLEPLAY: 3,
        GENERATOR_TOPIC: 5,
        GENERATOR_INGEST: 5,
      });

      const updated = await http()
        .patch('/admin/billing/credit-costs/TUTOR_ROLEPLAY')
        .set(boss.auth)
        .send({ cost: 4 })
        .expect(200);
      expect(updated.body.costs.TUTOR_ROLEPLAY).toBe(4);

      const mine = await http()
        .get('/me/credits')
        .set(student.auth)
        .expect(200);
      expect(mine.body.costs.TUTOR_ROLEPLAY).toBe(4);

      const reservation = await credits.reserve(student.id, 'TUTOR_ROLEPLAY');
      expect(reservation.cost).toBe(4);
      expect(reservation.balanceAfter).toBe(6);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'credit-cost.update',
        targetType: 'credit_cost',
        targetId: 'TUTOR_ROLEPLAY',
        details: { feature: 'TUTOR_ROLEPLAY', from: 3, to: 4 },
      });
    });

    it('recusa custo fora de 1–100 e feature que não gasta crédito', async () => {
      const boss = await admin();

      for (const cost of [0, 101, 2.5]) {
        await http()
          .patch('/admin/billing/credit-costs/TUTOR_CORRECTION')
          .set(boss.auth)
          .send({ cost })
          .expect(400);
      }
      await http()
        .patch('/admin/billing/credit-costs/PDF_DOWNLOAD')
        .set(boss.auth)
        .send({ cost: 2 })
        .expect(400);

      expect(await auditRows()).toEqual([]);
    });
  });

  describe('métricas', () => {
    it('recalcular o período é auditado; intervalo inválido não é', async () => {
      const boss = await admin();

      await http()
        .post('/admin/metrics/rebuild')
        .set(boss.auth)
        .send({ from: '2026-09-01', to: '2026-09-03' })
        .expect(202);
      await http()
        .post('/admin/metrics/rebuild')
        .set(boss.auth)
        .send({ from: '2026-09-05', to: '2026-09-03' })
        .expect(400);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'metrics.rebuild',
        targetType: 'metrics',
        targetId: null,
        details: { from: '2026-09-01', to: '2026-09-03' },
      });
    });
  });

  describe('log de auditoria', () => {
    it('lista do mais recente ao mais antigo, com filtros, paginação e o e-mail do aluno', async () => {
      const boss = await admin();
      const student = await account('aluno@exemplo.com', 'Aluna Souza');
      await freeCredited(student.id);

      await http()
        .post(`/admin/billing/users/${student.id}/credits/bonus`)
        .set(boss.auth)
        .send({ amount: 5, reason: 'primeiro' })
        .expect(201);
      await http()
        .patch('/admin/billing/credit-costs/GENERATOR_TOPIC')
        .set(boss.auth)
        .send({ cost: 6 })
        .expect(200);
      await http().get(`/admin/users/${student.id}`).set(boss.auth).expect(200);

      const all = await http()
        .get('/admin/audit-log')
        .set(boss.auth)
        .expect(200);
      expect(
        all.body.data.map((row: { action: string }) => row.action),
      ).toEqual(['student.view', 'credit-cost.update', 'credits.bonus']);
      expect(all.body.data[0]).toMatchObject({
        actorEmail: 'admin@exemplo.com',
        targetLabel: 'aluno@exemplo.com',
      });
      expect(all.body.data[1].targetLabel).toBeNull();

      const bonus = await http()
        .get('/admin/audit-log?action=credits.bonus')
        .set(boss.auth)
        .expect(200);
      expect(bonus.body.data).toHaveLength(1);

      const ofStudent = await http()
        .get(`/admin/audit-log?targetId=${student.id}`)
        .set(boss.auth)
        .expect(200);
      expect(ofStudent.body.data).toHaveLength(2);

      const none = await http()
        .get(`/admin/audit-log?actorId=${student.id}`)
        .set(boss.auth)
        .expect(200);
      expect(none.body.data).toEqual([]);

      const future = await http()
        .get('/admin/audit-log?from=2999-01-01T00:00:00.000Z')
        .set(boss.auth)
        .expect(200);
      expect(future.body.data).toEqual([]);

      const page = await http()
        .get('/admin/audit-log?limit=2')
        .set(boss.auth)
        .expect(200);
      expect(page.body.data).toHaveLength(2);
      expect(page.body.hasMore).toBe(true);
      const rest = await http()
        .get(
          `/admin/audit-log?limit=2&cursor=${page.body.nextCursor as string}`,
        )
        .set(boss.auth)
        .expect(200);
      expect(rest.body.data).toHaveLength(1);
      expect(rest.body.data[0].action).toBe('credits.bonus');

      await http()
        .get('/admin/audit-log?action=qualquer-coisa')
        .set(boss.auth)
        .expect(400);
    });
  });
});
