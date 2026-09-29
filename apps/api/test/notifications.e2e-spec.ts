import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import request from 'supertest';

import { ConsoleMailService } from 'src/infra/mail/console-mail.service';
import { QUEUES } from 'src/infra/queue/queues';
import { ReminderService } from 'src/modules/notifications/services/reminder.service';
import { FakeWebPushSender } from 'src/modules/notifications/services/web-push-sender';

import { curriculumSeed } from '../prisma/seeds/curriculum.seed';
import { createTestApp, type TestApp } from './utils/create-test-app';

const PASSWORD = 'senhaforte2026';
const TZ = 'America/Sao_Paulo';
/** Quarta-feira, 19:05 em São Paulo (UTC−3). */
const WEDNESDAY = '2026-09-30';
const AT_19H = new Date(`${WEDNESDAY}T22:05:00Z`);
/** Segunda-feira, 19:05 em São Paulo. */
const MONDAY = '2026-09-28';
const MONDAY_19H = new Date(`${MONDAY}T22:05:00Z`);
const ENDPOINT = 'https://push.example.com/send/abc123';

/**
 * Módulo 15. O relógio entra pelo tick e pelos dados do job: o teste
 * escolhe "quarta às 19h em São Paulo" sem depender da hora da máquina.
 * E-mail pelo `ConsoleMailService`, push pelo `FakeWebPushSender`.
 */
describe('Notifications (e2e)', () => {
  let context: TestApp;
  let reminders: ReminderService;
  let mail: ConsoleMailService;
  let push: FakeWebPushSender;
  let queue: Queue;

  beforeAll(async () => {
    context = await createTestApp();
    reminders = context.app.get(ReminderService);
    mail = context.app.get(ConsoleMailService);
    push = context.app.get(FakeWebPushSender);
    queue = context.app.get<Queue>(getQueueToken(QUEUES.NOTIFICATIONS));
  });

  beforeEach(async () => {
    await context.resetDatabase();
    await context.flushCatalogCache();
    await context.resetRateLimit();
    await curriculumSeed.run(context.prisma);
    mail.clear();
    push.reset();
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await context.close();
  });

  const http = () => request(context.app.getHttpServer());

  async function student(
    email = 'ana@exemplo.com',
    options: {
      preferredStudyTime?: 'MORNING' | 'EVENING';
      timezone?: string;
    } = {},
  ) {
    const signup = await http()
      .post('/auth/signup')
      .send({
        name: 'Ana Souza',
        email,
        password: PASSWORD,
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
      })
      .expect(201);
    const userId = signup.body.user.id as string;
    const profile = {
      timezone: options.timezone ?? TZ,
      preferredStudyTime: options.preferredStudyTime ?? 'EVENING',
      availabilityMinutes: { wed: 20, mon: 20 },
      onboardingCompletedAt: new Date('2026-09-01T12:00:00Z'),
    };
    await context.prisma.studentProfile.upsert({
      where: { userId },
      create: { userId, ...profile },
      update: profile,
    });
    // O e-mail de confirmação do cadastro não interessa aqui.
    mail.clear();

    return {
      userId,
      email,
      auth: { Authorization: `Bearer ${signup.body.accessToken as string}` },
    };
  }

  /** A agenda do dia, gravada pronta: 1 revisão e "At the airport". */
  async function agenda(userId: string, localDate = WEDNESDAY) {
    await context.prisma.dailyAgenda.create({
      data: {
        userId,
        localDate,
        blocks: [
          {
            id: 'review',
            type: 'REVIEW',
            refId: 'review',
            estimatedMinutes: 2,
            count: 1,
            reason: '1 cards de revisão vencidos.',
            status: 'PENDING',
          },
          {
            id: 'lesson:x',
            type: 'LESSON',
            refId: 'x',
            estimatedMinutes: 10,
            title: 'At the airport',
            reason: 'Próxima do plano.',
            status: 'PENDING',
          },
        ],
      },
    });
  }

  const job = (userId: string, at = AT_19H, localDate = WEDNESDAY) => ({
    userId,
    timezone: TZ,
    localDate,
    at: at.toISOString(),
  });

  async function waitFor<T>(read: () => Promise<T | null>, what: string) {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const value = await read();
      if (value !== null) return value;
      if (Date.now() > deadline) throw new Error(`Tempo esgotado: ${what}`);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  it('o tick do fuso manda o lembrete de quem tem essa hora, uma vez só', async () => {
    const ana = await student();
    await student('bia@exemplo.com', { preferredStudyTime: 'MORNING' });
    await student('leo@exemplo.com', { timezone: 'Europe/Lisbon' });
    await agenda(ana.userId);

    const counts = await reminders.tick(TZ, AT_19H);
    // Só a Ana: Bia é de manhã; Leo está em outro fuso (tick próprio).
    expect(counts).toEqual({ reminders: 1, weekly: 0 });

    const log = await waitFor(
      () =>
        context.prisma.notificationLog.findFirst({
          where: { userId: ana.userId, channels: { isEmpty: false } },
        }),
      'lembrete enviado pela fila',
    );
    expect(log).toMatchObject({
      type: 'DAILY_REMINDER',
      localDate: WEDNESDAY,
      channels: ['EMAIL'],
    });

    const email = mail.lastTo(ana.email);
    expect(email?.subject).toBe('Seu plano de hoje');
    expect(email?.text).toContain(
      'Faltam 12 min para fechar o plano de hoje: 1 revisão e a lição "At the airport".',
    );
    expect(email?.text).toContain('Oi, Ana.');

    // De novo no mesmo dia (outro tick, retry): nada novo.
    const again = await reminders.sendReminder(job(ana.userId));
    expect(again.decision).toEqual({
      send: false,
      reason: 'ALREADY_REMINDED_TODAY',
    });
    expect(mail.sent.filter((m) => m.to === ana.email)).toHaveLength(1);
  });

  it('push opcional por navegador: entrega junto com o e-mail e some quando o navegador cancela', async () => {
    const ana = await student();

    const prefs = await http()
      .get('/me/notifications/preferences')
      .set(ana.auth)
      .expect(200);
    expect(prefs.body).toMatchObject({
      channels: { email: true, push: false },
      effectiveReminderHour: 19,
      quietHours: { start: 22, end: 8 },
      push: { available: true, devices: 0 },
    });

    await http()
      .get('/me/notifications/push/public-key')
      .set(ana.auth)
      .expect(200, { publicKey: 'fake-vapid-public-key' });
    const subscribed = await http()
      .post('/me/notifications/push/subscriptions')
      .set(ana.auth)
      .send({ endpoint: ENDPOINT, keys: { p256dh: 'p256', auth: 'auth' } })
      .expect(201);
    expect(subscribed.body).toMatchObject({
      channels: { push: true },
      push: { devices: 1 },
    });

    await agenda(ana.userId);
    const result = await reminders.sendReminder(job(ana.userId));
    expect(result.outcome).toBe('SENT');
    expect(push.sent).toEqual([
      {
        endpoint: ENDPOINT,
        payload: expect.objectContaining({
          title: 'Seu plano de hoje',
          url: '/hoje',
          type: 'DAILY_REMINDER',
        }),
      },
    ]);
    const log = await context.prisma.notificationLog.findFirstOrThrow({
      where: { userId: ana.userId },
    });
    expect([...log.channels].sort()).toEqual(['EMAIL', 'WEB_PUSH']);

    // No dia seguinte o navegador já cancelou a inscrição (410).
    push.goneEndpoints.add(ENDPOINT);
    await agenda(ana.userId, '2026-10-01');
    await reminders.sendReminder(
      job(ana.userId, new Date('2026-10-01T22:05:00Z'), '2026-10-01'),
    );
    expect(await context.prisma.pushSubscription.count()).toBe(0);
    expect(mail.sent.filter((m) => m.to === ana.email)).toHaveLength(2);
  });

  it('dois envios simultâneos no mesmo dia: um só chega', async () => {
    const ana = await student();
    await http()
      .post('/me/notifications/push/subscriptions')
      .set(ana.auth)
      .send({ endpoint: ENDPOINT, keys: { p256dh: 'p256', auth: 'auth' } })
      .expect(201);
    await agenda(ana.userId);

    const results = await Promise.all([
      reminders.sendReminder(job(ana.userId)),
      reminders.sendReminder(job(ana.userId)),
    ]);

    expect(results.filter((result) => result.outcome === 'SENT')).toHaveLength(
      1,
    );
    expect(push.sent).toHaveLength(1);
    expect(mail.sent).toHaveLength(1);
    expect(await context.prisma.notificationLog.count()).toBe(1);
  });

  it('não lembra quem já estudou hoje', async () => {
    const ana = await student();
    await agenda(ana.userId);
    const item = await context.prisma.item.findFirstOrThrow({
      where: { slug: 'a1-be-i-am-maya' },
    });
    await context.prisma.answer.create({
      data: {
        userId: ana.userId,
        itemId: item.id,
        context: 'REVIEW',
        response: {},
        isCorrect: true,
        score: 1,
        responseTimeMs: 4_000,
        detectedErrorPatterns: [],
        isFirstTry: true,
        // 15h em São Paulo, no mesmo dia.
        createdAt: new Date(`${WEDNESDAY}T18:00:00Z`),
      },
    });

    const result = await reminders.sendReminder(job(ana.userId));

    expect(result.decision).toEqual({ send: false, reason: 'STUDIED_TODAY' });
    expect(mail.sent).toHaveLength(0);
  });

  it('respeita o horário silencioso e o tipo desligado', async () => {
    const ana = await student();
    await agenda(ana.userId);

    // Hora escolhida dentro do silencioso: recusado com explicação.
    const refused = await http()
      .patch('/me/notifications/preferences')
      .set(ana.auth)
      .send({ reminderHour: 23 })
      .expect(422);
    expect(refused.body.error.code).toBe('REMINDER_HOUR_IN_QUIET_TIME');

    await http()
      .patch('/me/notifications/preferences')
      .set(ana.auth)
      .send({ quietHours: { start: 18, end: 8 } })
      .expect(200);
    expect(
      (await reminders.sendReminder(job(ana.userId))).decision,
    ).toMatchObject({ reason: 'QUIET_HOURS' });

    await http()
      .patch('/me/notifications/preferences')
      .set(ana.auth)
      .send({
        quietHours: { start: 22, end: 8 },
        types: { dailyReminder: false },
      })
      .expect(200);
    expect(
      (await reminders.sendReminder(job(ana.userId))).decision,
    ).toMatchObject({ reason: 'DISABLED' });

    expect(mail.sent).toHaveLength(0);
  });

  it('com muitas revisões vencidas, o aviso delas substitui o diário', async () => {
    const ana = await student();
    await agenda(ana.userId);
    await context.prisma.reviewCard.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        userId: ana.userId,
        kind: 'VOCAB' as const,
        refId: `vocab.fake-${String(index)}`,
        source: 'LESSON' as const,
        due: new Date(`${WEDNESDAY}T10:00:00Z`),
        stability: 1,
        difficulty: 5,
      })),
    });

    const result = await reminders.sendReminder(job(ana.userId));

    expect(result.decision).toEqual({ send: true, type: 'REVIEW_BACKLOG' });
    expect(mail.lastTo(ana.email)?.text).toContain(
      'Você tem 30 revisões esperando. Uma sessão de 10 min já dá conta de 24 delas.',
    );
  });

  it('resumo semanal na segunda, com link para parar de receber', async () => {
    const ana = await student();
    await context.prisma.userDailyActivity.createMany({
      data: ['2026-09-21', '2026-09-23', '2026-09-26'].map((date) => ({
        userId: ana.userId,
        date: new Date(`${date}T00:00:00Z`),
        studySeconds: 1_200,
        plannedMinutes: 20,
        lessonsCompleted: 1,
        reviewsDone: 5,
        firstTryAnswers: 10,
        firstTryCorrect: 8,
        active: true,
      })),
    });

    const counts = await reminders.tick(TZ, MONDAY_19H);
    expect(counts.weekly).toBe(1);

    await waitFor(
      async () =>
        mail.sent.find((m) => m.subject === 'Sua semana no inglês') ?? null,
      'resumo semanal',
    );
    const email = mail.sent.find((m) => m.subject === 'Sua semana no inglês');
    expect(email?.text).toContain(
      'Na semana passada: 60 min de estudo em 3 dias, 3 lições concluídas e 15 revisões. Acerto de primeira: 80%. Você cumpriu os 60 min planejados.',
    );

    // Push não entra no resumo, mesmo com o navegador inscrito.
    expect(push.sent).toHaveLength(0);

    const token = /token=([\w.-]+)/.exec(email?.text ?? '')?.[1] ?? '';
    const res = await http()
      .post('/notifications/unsubscribe')
      .send({ token })
      .expect(200);
    expect(res.body.message).toContain('o resumo semanal');

    const prefs = await http()
      .get('/me/notifications/preferences')
      .set(ana.auth)
      .expect(200);
    expect(prefs.body.types).toEqual({
      dailyReminder: true,
      reviewBacklog: true,
      weeklySummary: false,
    });
    expect(
      await reminders.sendWeeklySummary(job(ana.userId, MONDAY_19H, MONDAY)),
    ).toBe('SKIPPED');

    await http()
      .post('/notifications/unsubscribe')
      .send({ token: `${token}x` })
      .expect(400);
  });
});
