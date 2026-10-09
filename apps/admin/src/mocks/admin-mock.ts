import {
  CREDIT_FEATURES,
  creditCostValueSchema,
  grantBonusSchema,
  updatePlanSchema,
} from '@english-saas/shared';
import { http, HttpResponse } from 'msw';

import {
  API_URL,
  ITEM_AM_ID,
  ITEM_ORDER_ID,
  error,
  takeFailure,
} from './curriculum-mock';

/**
 * Gestão do admin simulada (alunos, planos, custo dos créditos, métricas e
 * auditoria), com estado: conceder crédito soma ao extrato e ao saldo, editar
 * plano e custo muda o que a tela lê de novo, e **cada ação grava a sua linha
 * no log de auditoria** — como a API faz. Valida os pedidos com os mesmos
 * schemas do servidor (`packages/shared`).
 *
 * Chaves de `failNext`: `users-list`, `student-overview`, `student-progress`,
 * `student-plan`, `student-history`, `student-subscription`, `student-credits`,
 * `student-credit-history`, `student-ai-usage`, `bonus-grant`, `plans-list`,
 * `plan-update`, `credit-costs`, `credit-cost-update`, `metrics`, `audit-list`.
 */

export const ADMIN_ACTOR = { id: 'admin-1', email: 'admin@exemplo.com' };

export const STUDENT_ANA_ID = 'student-ana';
export const STUDENT_BRUNO_ID = 'student-bruno';
export const STUDENT_CARLA_ID = 'student-carla';
export const STUDENT_DORA_ID = 'student-dora';
export const EDITOR_ID = 'user-editor';
export const PLAN_PLUS_ID = 'plan-plus-monthly';
export const PLAN_FREE_ID = 'plan-free';
export const PLAN_BASE_ID = 'plan-base-monthly';

/** O dia em que a API terminou o período padrão (ontem, no fuso das métricas). */
export const METRICS_DEFAULT_TO = '2026-10-07';

const COSTS_BASE = `${API_URL}/admin/billing`;
const USERS_BASE = `${API_URL}/admin/users`;

type MockUser = {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'EDITOR' | 'ADMIN';
  emailVerifiedAt: string | null;
  deletedAt: string | null;
  anonymizedAt: string | null;
  createdAt: string;
  profile: boolean;
};

type LedgerEntry = {
  id: string;
  kind: 'GRANT' | 'CONSUME' | 'REFUND' | 'BONUS';
  amount: number;
  feature: string | null;
  reason: string | null;
  cycleKey: string | null;
  createdAt: string;
};

type MockPlan = {
  id: string;
  tier: 'FREE' | 'BASE' | 'PLUS';
  billingPeriod: 'MONTHLY' | 'YEARLY' | null;
  priceCents: number;
  monthlyAiCredits: number;
  active: boolean;
};

type MockAudit = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
};

export type AdminMockState = {
  /** Cada ação nova anda um minuto: o log fica em ordem e determinístico. */
  clock: number;
  counter: number;
  users: MockUser[];
  ledger: Map<string, LedgerEntry[]>;
  plans: MockPlan[];
  costs: Record<string, number>;
  audit: MockAudit[];
  /** Os intervalos pedidos a `GET /admin/metrics` (`null` = o padrão). */
  metricsRequests: ({ from: string; to: string } | null)[];
};

const CLOCK_START = Date.UTC(2026, 9, 8, 12, 0, 0);

function day(month: number, dayOfMonth: number): string {
  return new Date(
    Date.UTC(2026, month - 1, dayOfMonth, 12, 0, 0),
  ).toISOString();
}

function seedUsers(): MockUser[] {
  const fillers: MockUser[] = Array.from({ length: 24 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');

    return {
      id: `student-${n}`,
      email: `aluno${n}@exemplo.com`,
      name: `Aluno ${n}`,
      role: 'STUDENT',
      emailVerifiedAt: day(8, 1),
      deletedAt: null,
      anonymizedAt: null,
      createdAt: new Date(Date.UTC(2026, 7, 31 - index, 12)).toISOString(),
      profile: false,
    };
  });

  return [
    {
      id: STUDENT_ANA_ID,
      email: 'ana.lima@exemplo.com',
      name: 'Ana Lima',
      role: 'STUDENT',
      emailVerifiedAt: day(9, 2),
      deletedAt: null,
      anonymizedAt: null,
      createdAt: day(10, 6),
      profile: true,
    },
    {
      id: STUDENT_BRUNO_ID,
      email: 'bruno@exemplo.com',
      name: 'Bruno Costa',
      role: 'STUDENT',
      emailVerifiedAt: null,
      deletedAt: null,
      anonymizedAt: null,
      createdAt: day(10, 5),
      profile: false,
    },
    {
      id: STUDENT_CARLA_ID,
      email: 'carla@exemplo.com',
      name: 'Carla Dias',
      role: 'STUDENT',
      emailVerifiedAt: day(9, 20),
      deletedAt: day(10, 3),
      anonymizedAt: null,
      createdAt: day(10, 4),
      profile: true,
    },
    {
      id: STUDENT_DORA_ID,
      email: 'anon-7f3a@anon.invalid',
      name: 'Conta anonimizada',
      role: 'STUDENT',
      emailVerifiedAt: null,
      deletedAt: day(8, 20),
      anonymizedAt: day(9, 20),
      createdAt: day(10, 3),
      profile: false,
    },
    {
      id: EDITOR_ID,
      email: 'editora@exemplo.com',
      name: 'Editora Teste',
      role: 'EDITOR',
      emailVerifiedAt: day(9, 1),
      deletedAt: null,
      anonymizedAt: null,
      createdAt: day(10, 2),
      profile: false,
    },
    {
      id: ADMIN_ACTOR.id,
      email: ADMIN_ACTOR.email,
      name: 'Admin Silva',
      role: 'ADMIN',
      emailVerifiedAt: day(9, 1),
      deletedAt: null,
      anonymizedAt: null,
      createdAt: day(10, 1),
      profile: false,
    },
    ...fillers,
  ];
}

function seedLedger(): Map<string, LedgerEntry[]> {
  return new Map([
    [
      STUDENT_ANA_ID,
      [
        {
          id: 'led-1',
          kind: 'GRANT',
          amount: 500,
          feature: null,
          reason: 'monthly_plus',
          cycleKey: 'PLUS:2026-10',
          createdAt: day(10, 1),
        },
        {
          id: 'led-2',
          kind: 'CONSUME',
          amount: -3,
          feature: 'TUTOR_ROLEPLAY',
          reason: null,
          cycleKey: null,
          createdAt: day(10, 3),
        },
        {
          id: 'led-3',
          kind: 'CONSUME',
          amount: -1,
          feature: 'TUTOR_CORRECTION',
          reason: null,
          cycleKey: null,
          createdAt: day(10, 4),
        },
      ],
    ],
    [
      STUDENT_BRUNO_ID,
      [
        {
          id: 'led-4',
          kind: 'GRANT',
          amount: 10,
          feature: null,
          reason: 'monthly_free',
          cycleKey: 'FREE:2026-10',
          createdAt: day(10, 5),
        },
      ],
    ],
  ]);
}

function seedPlans(): MockPlan[] {
  return [
    {
      id: PLAN_FREE_ID,
      tier: 'FREE',
      billingPeriod: null,
      priceCents: 0,
      monthlyAiCredits: 10,
      active: true,
    },
    {
      id: PLAN_BASE_ID,
      tier: 'BASE',
      billingPeriod: 'MONTHLY',
      priceCents: 3990,
      monthlyAiCredits: 100,
      active: true,
    },
    {
      id: 'plan-base-yearly',
      tier: 'BASE',
      billingPeriod: 'YEARLY',
      priceCents: 39900,
      monthlyAiCredits: 100,
      active: false,
    },
    {
      id: PLAN_PLUS_ID,
      tier: 'PLUS',
      billingPeriod: 'MONTHLY',
      priceCents: 6990,
      monthlyAiCredits: 500,
      active: true,
    },
  ];
}

function seedAudit(): MockAudit[] {
  return [
    {
      id: 'aud-1',
      actorId: 'admin-2',
      actorEmail: 'marta@exemplo.com',
      action: 'plan.update',
      targetType: 'plan',
      targetId: PLAN_BASE_ID,
      details: {
        tier: 'BASE',
        billingPeriod: 'MONTHLY',
        changes: { priceCents: { from: 2990, to: 3990 } },
      },
      requestId: null,
      createdAt: day(10, 2),
    },
    {
      id: 'aud-2',
      actorId: 'admin-2',
      actorEmail: 'marta@exemplo.com',
      action: 'credits.bonus',
      targetType: 'user',
      targetId: STUDENT_BRUNO_ID,
      details: {
        amount: 5,
        reason: 'Teste da cota gratuita',
        balanceAfter: 15,
      },
      requestId: null,
      createdAt: day(10, 3),
    },
  ];
}

function initialState(): AdminMockState {
  return {
    clock: CLOCK_START,
    counter: 0,
    users: seedUsers(),
    ledger: seedLedger(),
    plans: seedPlans(),
    costs: {
      TUTOR_CORRECTION: 1,
      TUTOR_ROLEPLAY: 3,
      GENERATOR_TOPIC: 5,
      GENERATOR_INGEST: 5,
    },
    audit: seedAudit(),
    metricsRequests: [],
  };
}

export let adminState: AdminMockState = initialState();

export function resetAdminMock(): void {
  adminState = initialState();
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

function record(
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
): void {
  adminState.clock += 60_000;
  adminState.counter += 1;
  adminState.audit.push({
    id: `aud-new-${String(adminState.counter)}`,
    actorId: ADMIN_ACTOR.id,
    actorEmail: ADMIN_ACTOR.email,
    action,
    targetType,
    targetId,
    details,
    requestId: null,
    createdAt: new Date(adminState.clock).toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

function userRow(user: MockUser) {
  const { profile: _profile, ...row } = user;

  return row;
}

function findUser(id: string | readonly string[] | undefined): MockUser | null {
  return adminState.users.find((user) => user.id === id) ?? null;
}

function balanceOf(userId: string): number {
  return (adminState.ledger.get(userId) ?? []).reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
}

function tierOf(userId: string): 'FREE' | 'BASE' | 'PLUS' {
  return userId === STUDENT_ANA_ID ? 'PLUS' : 'FREE';
}

function quotaOf(tier: 'FREE' | 'BASE' | 'PLUS'): number {
  return (
    adminState.plans.find((plan) => plan.tier === tier)?.monthlyAiCredits ?? 0
  );
}

function priceLabel(plan: MockPlan): string {
  if (plan.billingPeriod === null) {
    return 'Grátis';
  }

  const reais = (plan.priceCents / 100).toFixed(2).replace('.', ',');

  return `R$ ${reais} por ${plan.billingPeriod === 'MONTHLY' ? 'mês' : 'ano'}`;
}

function planView(plan: MockPlan) {
  return { ...plan, priceLabel: priceLabel(plan) };
}

function cursorPage<T extends { id: string }>(
  rows: readonly T[],
  url: URL,
  defaultLimit = 25,
) {
  const limit = Number(url.searchParams.get('limit') ?? defaultLimit);
  const cursor = url.searchParams.get('cursor');
  const start =
    cursor === null ? 0 : rows.findIndex((r) => r.id === cursor) + 1;
  const slice = rows.slice(start, start + limit);
  const hasMore = start + limit < rows.length;

  return {
    data: slice,
    hasMore,
    nextCursor: hasMore ? (slice.at(-1)?.id ?? null) : null,
  };
}

function unknownStudent(): Response {
  return error(404, 'NOT_FOUND', 'Não encontramos este aluno.');
}

function validationError(message: string): Response {
  return error(400, 'VALIDATION_ERROR', message);
}

// --- Progresso ---

const COMPETENCIES = [
  ['GRAMMAR', 'Gramática'],
  ['VOCABULARY', 'Vocabulário'],
  ['LISTENING', 'Escuta'],
  ['READING', 'Leitura'],
  ['WRITING', 'Escrita'],
  ['SPEAKING', 'Fala'],
] as const;

function richProgress() {
  const levels = ['B1', 'B1', 'A2', 'A2', 'A1', null] as const;
  const confidence = ['MEDIUM', 'HIGH', 'LOW', 'MEDIUM', 'LOW', 'LOW'] as const;
  const confidenceText = {
    LOW: 'Ainda poucos dados',
    MEDIUM: 'Estimativa razoável',
    HIGH: 'Estimativa firme',
  } as const;

  return {
    period: { from: '2026-08-17', to: '2026-10-07', weeks: 8 },
    level: {
      overall: {
        level: 'A2',
        label: 'Básico',
        note: 'Calculado a partir das respostas do aluno.',
      },
      competencies: COMPETENCIES.map(([competency, label], index) => ({
        competency,
        label,
        level: levels[index] ?? null,
        confidence: confidenceText[confidence[index] ?? 'LOW'],
        confidenceLevel: confidence[index] ?? 'LOW',
      })),
      weekly: [
        { weekStart: '2026-09-14', overallLevel: 'A1', levels: {} },
        { weekStart: '2026-09-21', overallLevel: 'A2', levels: {} },
        { weekStart: '2026-09-28', overallLevel: 'A2', levels: {} },
        { weekStart: '2026-10-05', overallLevel: 'A2', levels: {} },
      ],
    },
    strengths: [
      {
        skillId: 'function.introduce-yourself',
        title: 'Se apresentar',
        text: 'Domina: Se apresentar.',
      },
    ],
    weaknesses: [
      {
        skillId: 'grammar.past-simple',
        title: 'Passado simples',
        text: 'Erra mais do que acerta no passado simples.',
        action: {
          type: 'LESSON',
          refId: 'lesson-yesterday',
          lessonSlug: 'yesterday',
          label: 'Faça a lição "Yesterday"',
        },
      },
      {
        skillId: 'grammar.articles',
        title: 'Artigos',
        text: 'O mesmo erro de artigo aparece com frequência.',
        action: {
          type: 'REVIEW',
          refId: 'card-1',
          lessonSlug: null,
          label: 'Revise na sessão de revisão',
        },
      },
    ],
    stats: {
      minutesStudied: 340,
      lessonsCompleted: 6,
      reviewsDone: 48,
      currentStreak: 3,
      longestStreak: 9,
      accuracyByCompetency: [],
      topErrors: [
        {
          errorPatternId: 'l1.have-for-age',
          description: 'Dizer "I have 20 years" em vez de "I am 20 years old"',
          correction: 'I am 20 years old',
          recentOccurrences: 3,
          opportunities: 12,
          trend: 'DECREASING',
          trendLabel: 'Está diminuindo',
        },
      ],
    },
    plan: {
      weeks: [
        {
          weekStart: '2026-09-21',
          plannedMinutes: 120,
          studiedMinutes: 60,
          ratio: 0.5,
        },
        {
          weekStart: '2026-09-28',
          plannedMinutes: 120,
          studiedMinutes: 100,
          ratio: 0.83,
        },
        {
          weekStart: '2026-10-05',
          plannedMinutes: 120,
          studiedMinutes: 90,
          ratio: 0.75,
        },
      ],
    },
    forecast: {
      byPlan: '2026-12-15',
      byPace: '2027-01-12',
      weeksDifference: 4,
      status: 'BEHIND',
      message:
        'No ritmo atual, a chegada ao B1 passa de dezembro para janeiro.',
      targetLevel: 'B1',
    },
  };
}

function newStudentProgress() {
  return {
    period: { from: '2026-08-17', to: '2026-10-07', weeks: 8 },
    level: {
      overall: {
        level: 'A1',
        label: 'Iniciante',
        note: 'Ainda sem respostas.',
      },
      competencies: COMPETENCIES.map(([competency, label]) => ({
        competency,
        label,
        level: null,
        confidence: 'Ainda poucos dados',
        confidenceLevel: 'LOW',
      })),
      weekly: [],
    },
    strengths: [],
    weaknesses: [],
    stats: {
      minutesStudied: 0,
      lessonsCompleted: 0,
      reviewsDone: 0,
      currentStreak: 0,
      longestStreak: 0,
      accuracyByCompetency: [],
      topErrors: [],
    },
    plan: { weeks: [] },
    forecast: {
      byPlan: null,
      byPace: null,
      weeksDifference: null,
      status: 'NO_STUDY',
      message: 'Ainda não há estudo para prever.',
      targetLevel: null,
    },
  };
}

// --- Plano, histórico, assinatura, uso de IA ---

function richPlan() {
  return {
    plan: {
      targetLevel: 'B1',
      targetDate: '2026-12-15',
      path: Array.from({ length: 10 }, (_, index) => ({
        lessonId: `lesson-${String(index + 1)}`,
        slug: `lesson-${String(index + 1)}`,
        unitId: 'unit-1',
        title: `Lição do plano ${String(index + 1)}`,
        cefrLevel: index < 6 ? 'A2' : 'B1',
        estimatedMinutes: 15,
        order: index,
        reason: 'Próxima na trilha do nível A2',
      })),
      reinforceSkillIds: ['grammar.past-simple'],
      forecast: {
        estimatedArrival: '2026-12-10',
        weeksNeeded: 9,
        realistic: true,
        message: 'No ritmo planejado, chega ao B1 em dezembro.',
      },
      version: 3,
    },
    pace: { weeksBehind: 4, message: 'Quatro semanas atrás do plano.' },
  };
}

function historyOf(userId: string) {
  if (userId !== STUDENT_ANA_ID) {
    return [];
  }

  const statuses = [
    'COMPLETED',
    'COMPLETED',
    'IN_PROGRESS',
    'ABANDONED',
  ] as const;

  return Array.from({ length: 23 }, (_, index) => {
    const status = statuses[index % statuses.length] ?? 'COMPLETED';

    return {
      id: `att-${String(index + 1)}`,
      attemptId: `att-${String(index + 1)}`,
      lessonId: `lesson-${String(index + 1)}`,
      lessonSlug: `lesson-${String(index + 1)}`,
      title: `Lição ${String(index + 1)}`,
      cefrLevel: index < 12 ? 'A1' : 'A2',
      version: 1,
      status,
      source: 'PLAN',
      currentStepIndex: status === 'COMPLETED' ? 5 : 2,
      xpEarned: status === 'COMPLETED' ? 40 : 10,
      startedAt: new Date(
        Date.UTC(2026, 9, 7, 18, 0) - index * 86_400_000,
      ).toISOString(),
      completedAt:
        status === 'COMPLETED'
          ? new Date(
              Date.UTC(2026, 9, 7, 18, 20) - index * 86_400_000,
            ).toISOString()
          : null,
    };
  });
}

function subscriptionOf(userId: string) {
  if (userId !== STUDENT_ANA_ID) {
    return { tier: 'FREE', message: 'Plano gratuito.', subscription: null };
  }

  return {
    tier: 'PLUS',
    message: 'Plano Plus ativo.',
    subscription: {
      id: 'sub-1',
      tier: 'PLUS',
      billingPeriod: 'MONTHLY',
      status: 'ACTIVE',
      priceCents: 6990,
      priceLabel: 'R$ 69,90 por mês',
      paymentMethod: 'PIX',
      checkoutUrl: null,
      currentPeriodEnd: '2026-10-30T12:00:00.000Z',
      accessUntil: '2026-10-30T12:00:00.000Z',
      canceledAt: null,
    },
  };
}

function aiUsageOf(userId: string) {
  if (userId !== STUDENT_ANA_ID) {
    return {
      totals: { calls: 0, inputTokens: 0, outputTokens: 0, costUsdMicros: 0 },
      byFeature: [],
    };
  }

  return {
    totals: {
      calls: 14,
      inputTokens: 9_800,
      outputTokens: 3_100,
      costUsdMicros: 61_500,
    },
    byFeature: [
      {
        feature: 'tutor-correction',
        calls: 11,
        inputTokens: 7_000,
        outputTokens: 2_000,
        costUsdMicros: 41_500,
      },
      {
        feature: 'tutor-roleplay-turn',
        calls: 3,
        inputTokens: 2_800,
        outputTokens: 1_100,
        costUsdMicros: 20_000,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const end = Date.parse(`${to}T00:00:00.000Z`);

  for (
    let time = Date.parse(`${from}T00:00:00.000Z`);
    time <= end;
    time += 86_400_000
  ) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }

  return dates;
}

function buildMetrics(from: string, to: string) {
  const dates = datesBetween(from, to);
  const daily = dates.map((date, index) => {
    const started = 10 + (index % 7);

    return {
      date,
      dau: 20 + ((index * 3) % 17),
      wau: 60 + ((index * 5) % 23),
      mau: 120 + index,
      newUsers: index % 4,
      lessonsStarted: started,
      lessonsCompleted: started - (index % 3),
    };
  });
  const started = daily.reduce((sum, row) => sum + row.lessonsStarted, 0);
  const completed = daily.reduce((sum, row) => sum + row.lessonsCompleted, 0);
  const abandoned = Math.ceil(started * 0.1);
  const last = daily.at(-1);
  const scale = dates.length;

  const lesson = (
    id: string,
    title: string | null,
    share: number,
    completion: number,
    accuracy: number | null,
  ) => {
    const lessonStarted = Math.round(started * share);

    return {
      lessonId: id,
      title,
      started: lessonStarted,
      completed: Math.round(lessonStarted * completion),
      firstTryAnswers: accuracy === null ? 0 : lessonStarted * 5,
      firstTryCorrect:
        accuracy === null ? 0 : Math.round(lessonStarted * 5 * accuracy),
      abandoned: Math.round(lessonStarted * (1 - completion)),
      completionRate: completion,
      accuracy,
    };
  };

  const dropoffs = [
    { stepIndex: 2, stepType: 'practice', count: Math.ceil(abandoned * 0.5) },
    {
      stepIndex: 4,
      stepType: 'free_writing',
      count: Math.ceil(abandoned * 0.3),
    },
    { stepIndex: 5, stepType: null, count: Math.ceil(abandoned * 0.1) },
  ];
  const hard = lesson(
    'lesson-hard',
    'Past simple: irregulares',
    0.3,
    0.45,
    0.52,
  );
  const dull = lesson('lesson-dull', 'At the airport', 0.25, 0.6, null);
  const good = lesson('lesson-good', null, 0.45, 0.9, 0.81);

  const features = [
    ['tutor-correction', 40, 4, 420_000],
    ['draft-lesson', 6, 0, 310_000],
    ['generator-material', 9, 2, 180_000],
    ['feature-nova', 2, 0, 20_000],
  ] as const;
  const BRL = 5.5;
  const brl = (micros: number) => Math.round((micros / 1_000_000) * BRL * 100);
  const tiers = [
    ['PLUS', 38, 2, 5, 600_000],
    ['FREE', 22, 4, 0, 130_000],
    ['SYSTEM', 6, 0, 0, 200_000],
  ] as const;
  const topCosts = Array.from(
    { length: 20 },
    (_, index) => 90_000 - index * 3_500,
  );
  const topIds = [
    STUDENT_ANA_ID,
    STUDENT_BRUNO_ID,
    STUDENT_DORA_ID,
    ...adminState.users
      .filter((user) => user.id.startsWith('student-') && user.id.length === 10)
      .map((user) => user.id),
  ];

  const revenueTier = (
    tier: 'FREE' | 'BASE' | 'PLUS',
    subscribers: number,
    mrrCents: number,
    activeUsers: number,
    aiCostUsdMicros: number,
  ) => {
    const revenueCents = Math.round(((mrrCents * 12) / 365) * scale);

    return {
      tier,
      subscribers,
      mrrCents,
      activeUsers,
      revenueCents,
      aiCostUsdMicros,
      aiCostBrlCents: brl(aiCostUsdMicros),
      marginCents: revenueCents - brl(aiCostUsdMicros),
    };
  };

  return {
    period: { from, to, days: dates.length },
    activity: {
      dau: last?.dau ?? 0,
      wau: last?.wau ?? 0,
      mau: last?.mau ?? 0,
      daily,
    },
    retention: [
      {
        cohortWeek: '2026-09-14',
        size: 12,
        weeks: [
          { offset: 0, retained: 12, rate: 1 },
          { offset: 1, retained: 6, rate: 0.5 },
          { offset: 2, retained: 3, rate: 0.25 },
          { offset: 3, retained: 1, rate: 0.083 },
        ],
      },
      {
        cohortWeek: '2026-09-21',
        size: 9,
        weeks: [
          { offset: 0, retained: 9, rate: 1 },
          { offset: 1, retained: 4, rate: 0.444 },
          { offset: 2, retained: 2, rate: 0.222 },
        ],
      },
      {
        cohortWeek: '2026-09-28',
        size: 15,
        weeks: [
          { offset: 0, retained: 15, rate: 1 },
          { offset: 1, retained: 5, rate: 0.333 },
        ],
      },
      {
        cohortWeek: '2026-10-05',
        size: 6,
        weeks: [{ offset: 0, retained: 6, rate: 1 }],
      },
    ],
    lessons: {
      started,
      completed,
      completionRate:
        started === 0 ? null : Math.round((completed / started) * 1000) / 1000,
      abandoned,
      abandonmentByStep: dropoffs,
      byLesson: [
        { ...good, abandonmentByStep: [dropoffs[2]] },
        { ...hard, abandonmentByStep: [dropoffs[0], dropoffs[1]] },
        { ...dull, abandonmentByStep: [dropoffs[0]] },
      ],
      worst: [hard, dull],
    },
    items: [
      {
        item: {
          id: ITEM_AM_ID,
          type: 'MULTIPLE_CHOICE',
          prompt: 'I ___ a student.',
          cefrLevel: 'A1',
          status: 'PUBLISHED',
          source: 'MANUAL',
          difficulty: -1.8,
          discrimination: 1,
          exposureCount: 320,
          correctRate: 0.97,
          skillIds: ['grammar.be.present.affirmative'],
        },
        flags: ['TOO_EASY'],
        pValue: 0.97,
        pointBiserial: 0.11,
        responses: 320,
        previousDifficulty: -1.2,
        appliedDifficulty: -1.8,
        calibratedAt: '2026-10-05T04:00:00.000Z',
      },
      {
        item: {
          id: ITEM_ORDER_ID,
          type: 'ORDER_WORDS',
          prompt: 'Ordene: she / works / in / a bank',
          cefrLevel: 'A2',
          status: 'PUBLISHED',
          source: 'AI_DRAFT_REVIEWED',
          difficulty: 1.4,
          discrimination: 1,
          exposureCount: 80,
          correctRate: 0.08,
          skillIds: ['grammar.third-person-s'],
        },
        flags: ['TOO_HARD', 'LOW_DISCRIMINATION'],
        pValue: 0.08,
        pointBiserial: 0.02,
        responses: 80,
        previousDifficulty: 1,
        appliedDifficulty: 1.4,
        calibratedAt: '2026-10-05T04:00:00.000Z',
      },
    ],
    aiCost: {
      totalUsdMicros: features.reduce((sum, row) => sum + row[3], 0),
      byFeature: features.map(([feature, calls, cacheHits, cost]) => ({
        feature,
        calls,
        cacheHits,
        costUsdMicros: cost,
        costBrlCents: brl(cost),
      })),
      byTier: tiers.map(([tier, calls, cacheHits, , cost]) => ({
        tier,
        calls,
        cacheHits,
        costUsdMicros: cost,
        costBrlCents: brl(cost),
      })),
      topUsers: topCosts.map((cost, index) => {
        const id = topIds[index] ?? `student-x${String(index)}`;
        const user = findUser(id);

        return {
          userId: id,
          email:
            user === null || user.anonymizedAt !== null ? null : user.email,
          calls: 30 - index,
          costUsdMicros: cost,
          costBrlCents: brl(cost),
        };
      }),
    },
    revenue: {
      usdBrlRate: BRL,
      byTier: [
        revenueTier('FREE', 0, 0, 40, 130_000),
        revenueTier('BASE', 3, 11_970, 3, 70_000),
        revenueTier('PLUS', 5, 34_950, 5, 600_000),
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const adminHandlers = [
  // --- Alunos ---

  http.get(USERS_BASE, ({ request }) => {
    const failure = takeFailure('users-list');
    if (failure !== null) {
      return failure;
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const rows = adminState.users
      .filter(
        (user) =>
          q === '' ||
          user.name.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q),
      )
      .map(userRow);

    return HttpResponse.json(cursorPage(rows, url));
  }),

  http.get(`${USERS_BASE}/:id`, ({ params }) => {
    const failure = takeFailure('student-overview');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);
    if (user === null) {
      return unknownStudent();
    }

    record('student.view', 'user', user.id);

    return HttpResponse.json({
      user: userRow(user),
      profile: user.profile
        ? {
            goals: ['TRAVEL', 'WORK'],
            goalNote: 'Viagem a Lisboa em março',
            preferredStudyTime: 'EVENING',
            selfReportedLevel: 'BASIC',
            timezone: 'America/Sao_Paulo',
            nativeLanguage: 'pt-BR',
            targetDate: '2026-12-15',
            availabilityMinutes: {
              mon: 30,
              tue: 30,
              wed: 0,
              thu: 30,
              fri: 0,
              sat: 60,
              sun: 0,
            },
          }
        : null,
      interests: user.profile
        ? [
            { topic: 'history', weight: 80 },
            { topic: 'football', weight: 40 },
          ]
        : [],
    });
  }),

  http.get(`${USERS_BASE}/:id/progress`, ({ params }) => {
    const failure = takeFailure('student-progress');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);

    return user === null
      ? unknownStudent()
      : HttpResponse.json(
          user.id === STUDENT_ANA_ID ? richProgress() : newStudentProgress(),
        );
  }),

  http.get(`${USERS_BASE}/:id/plan`, ({ params }) => {
    const failure = takeFailure('student-plan');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);

    if (user === null) {
      return unknownStudent();
    }

    return HttpResponse.json(
      user.id === STUDENT_ANA_ID ? richPlan() : { plan: null, pace: null },
    );
  }),

  http.get(`${USERS_BASE}/:id/history`, ({ params, request }) => {
    const failure = takeFailure('student-history');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);

    return user === null
      ? unknownStudent()
      : HttpResponse.json(
          cursorPage(
            historyOf(user.id).map(({ id, ...rest }) => ({ id, ...rest })),
            new URL(request.url),
            20,
          ),
        );
  }),

  http.get(`${USERS_BASE}/:id/subscription`, ({ params }) => {
    const failure = takeFailure('student-subscription');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);

    return user === null
      ? unknownStudent()
      : HttpResponse.json(subscriptionOf(user.id));
  }),

  http.get(`${USERS_BASE}/:id/credits`, ({ params }) => {
    const failure = takeFailure('student-credits');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);

    if (user === null) {
      return unknownStudent();
    }

    const tier = tierOf(user.id);

    return HttpResponse.json({
      tier,
      balance: balanceOf(user.id),
      monthlyAiCredits: quotaOf(tier),
      costs: adminState.costs,
      nextGrantAt: '2026-11-01T00:05:00.000Z',
    });
  }),

  http.get(`${USERS_BASE}/:id/credits/history`, ({ params, request }) => {
    const failure = takeFailure('student-credit-history');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);

    if (user === null) {
      return unknownStudent();
    }

    const rows = [...(adminState.ledger.get(user.id) ?? [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    return HttpResponse.json(cursorPage(rows, new URL(request.url), 20));
  }),

  http.get(`${USERS_BASE}/:id/ai-usage`, ({ params }) => {
    const failure = takeFailure('student-ai-usage');
    if (failure !== null) {
      return failure;
    }

    const user = findUser(params['id']);

    return user === null
      ? unknownStudent()
      : HttpResponse.json(aiUsageOf(user.id));
  }),

  // --- Planos, custo e bônus ---

  http.get(`${COSTS_BASE}/plans`, () => {
    const failure = takeFailure('plans-list');
    if (failure !== null) {
      return failure;
    }

    return HttpResponse.json(adminState.plans.map(planView));
  }),

  http.patch(`${COSTS_BASE}/plans/:id`, async ({ params, request }) => {
    const failure = takeFailure('plan-update');
    if (failure !== null) {
      return failure;
    }

    const plan = adminState.plans.find((entry) => entry.id === params['id']);

    if (plan === undefined) {
      return error(404, 'NOT_FOUND', 'Plano não encontrado.');
    }

    const parsed = updatePlanSchema.safeParse(await request.json());

    if (!parsed.success) {
      return validationError(
        parsed.error.issues[0]?.message ?? 'Pedido inválido.',
      );
    }

    const before = { ...plan };
    const patch = parsed.data;

    if (patch.priceCents !== undefined) {
      plan.priceCents = patch.priceCents;
    }
    if (patch.monthlyAiCredits !== undefined) {
      plan.monthlyAiCredits = patch.monthlyAiCredits;
    }
    if (patch.active !== undefined) {
      plan.active = patch.active;
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const key of ['priceCents', 'monthlyAiCredits', 'active'] as const) {
      if (before[key] !== plan[key]) {
        changes[key] = { from: before[key], to: plan[key] };
      }
    }

    record('plan.update', 'plan', plan.id, {
      tier: plan.tier,
      billingPeriod: plan.billingPeriod,
      changes,
    });

    return HttpResponse.json(planView(plan));
  }),

  http.get(`${COSTS_BASE}/credit-costs`, () => {
    const failure = takeFailure('credit-costs');
    if (failure !== null) {
      return failure;
    }

    return HttpResponse.json({ costs: adminState.costs });
  }),

  http.patch(
    `${COSTS_BASE}/credit-costs/:feature`,
    async ({ params, request }) => {
      const failure = takeFailure('credit-cost-update');
      if (failure !== null) {
        return failure;
      }

      const feature = String(params['feature']);

      if (!(CREDIT_FEATURES as readonly string[]).includes(feature)) {
        return validationError('Esta ação não gasta créditos.');
      }

      const body = (await request.json()) as { cost?: unknown };
      const parsed = creditCostValueSchema.safeParse(body.cost);

      if (!parsed.success) {
        return validationError('O custo deve ser um inteiro de 1 a 100.');
      }

      const from = adminState.costs[feature] ?? 0;
      adminState.costs[feature] = parsed.data;
      record('credit-cost.update', 'credit_cost', feature, {
        feature,
        from,
        to: parsed.data,
      });

      return HttpResponse.json({ costs: adminState.costs });
    },
  ),

  http.post(
    `${COSTS_BASE}/users/:userId/credits/bonus`,
    async ({ params, request }) => {
      const failure = takeFailure('bonus-grant');
      if (failure !== null) {
        return failure;
      }

      const user = findUser(params['userId']);

      if (user === null) {
        return unknownStudent();
      }

      const parsed = grantBonusSchema.safeParse(await request.json());

      if (!parsed.success) {
        return validationError(
          parsed.error.issues[0]?.message ?? 'Pedido inválido.',
        );
      }

      adminState.counter += 1;
      adminState.clock += 60_000;
      const entries = adminState.ledger.get(user.id) ?? [];

      entries.push({
        id: `led-new-${String(adminState.counter)}`,
        kind: 'BONUS',
        amount: parsed.data.amount,
        feature: null,
        reason: parsed.data.reason,
        cycleKey: null,
        createdAt: new Date(adminState.clock).toISOString(),
      });
      adminState.ledger.set(user.id, entries);

      const balance = balanceOf(user.id);

      record('credits.bonus', 'user', user.id, {
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        balanceAfter: balance,
      });

      return HttpResponse.json({ balance }, { status: 201 });
    },
  ),

  // --- Métricas ---

  http.get(`${API_URL}/admin/metrics`, ({ request }) => {
    const failure = takeFailure('metrics');
    if (failure !== null) {
      return failure;
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (from === null || to === null) {
      adminState.metricsRequests.push(null);

      return HttpResponse.json(buildMetrics('2026-09-08', METRICS_DEFAULT_TO));
    }

    if (from > to) {
      return validationError('A data inicial precisa vir antes da final.');
    }

    const span = (Date.parse(to) - Date.parse(from)) / 86_400_000;

    if (span >= 180) {
      return validationError('O intervalo pode ter no máximo 180 dias.');
    }

    adminState.metricsRequests.push({ from, to });

    return HttpResponse.json(buildMetrics(from, to));
  }),

  // --- Auditoria ---

  http.get(`${API_URL}/admin/audit-log`, ({ request }) => {
    const failure = takeFailure('audit-list');
    if (failure !== null) {
      return failure;
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const actorId = url.searchParams.get('actorId');
    const targetId = url.searchParams.get('targetId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const rows = [...adminState.audit]
      .filter(
        (entry) =>
          (action === null || entry.action === action) &&
          (actorId === null || entry.actorId === actorId) &&
          (targetId === null || entry.targetId === targetId) &&
          (from === null || entry.createdAt >= from) &&
          (to === null || entry.createdAt <= to),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => ({
        ...entry,
        targetLabel:
          entry.targetType === 'user' && entry.targetId !== null
            ? (findUser(entry.targetId)?.email ?? null)
            : null,
      }));

    return HttpResponse.json(cursorPage(rows, url, 30));
  }),
];
