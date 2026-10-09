import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { getMetrics } from './service';

const metrics = {
  period: { from: '2026-09-08', to: '2026-10-07', days: 30 },
  activity: {
    dau: 12,
    wau: 40,
    mau: 90,
    daily: [
      {
        date: '2026-10-07',
        dau: 12,
        wau: 40,
        mau: 90,
        newUsers: 3,
        lessonsStarted: 20,
        lessonsCompleted: 14,
      },
    ],
  },
  retention: [
    {
      cohortWeek: '2026-09-28',
      size: 10,
      weeks: [
        { offset: 0, retained: 10, rate: 1 },
        { offset: 1, retained: 4, rate: 0.4 },
      ],
    },
  ],
  lessons: {
    started: 20,
    completed: 14,
    completionRate: 0.7,
    abandoned: 3,
    abandonmentByStep: [{ stepIndex: 2, stepType: 'practice', count: 3 }],
    byLesson: [],
    worst: [],
  },
  items: [],
  aiCost: {
    totalUsdMicros: 1_500_000,
    byFeature: [
      {
        feature: 'tutor-correction',
        calls: 10,
        cacheHits: 1,
        costUsdMicros: 1_000_000,
        costBrlCents: 550,
      },
    ],
    byTier: [
      {
        tier: 'SYSTEM',
        calls: 2,
        cacheHits: 0,
        costUsdMicros: 500_000,
        costBrlCents: 275,
      },
    ],
    topUsers: [
      {
        userId: 'u1',
        email: null,
        calls: 4,
        costUsdMicros: 300_000,
        costBrlCents: 165,
      },
    ],
  },
  revenue: {
    usdBrlRate: 5.5,
    byTier: [
      {
        tier: 'PLUS',
        subscribers: 2,
        mrrCents: 13_980,
        activeUsers: 2,
        revenueCents: 13_980,
        aiCostUsdMicros: 500_000,
        aiCostBrlCents: 275,
        marginCents: 13_705,
      },
    ],
  },
};

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

const lastUrl = (fetchMock: ReturnType<typeof vi.fn>) =>
  (fetchMock.mock.calls.at(-1) as [string])[0];

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('métricas do admin', () => {
  it('sem intervalo, deixa a API usar o padrão (30 dias até ontem)', async () => {
    const fetchMock = stubFetch(metrics);

    const result = await getMetrics();

    expect(result.period.days).toBe(30);
    expect(lastUrl(fetchMock)).toBe('http://api.local/admin/metrics');
  });

  it('com intervalo, manda from e to', async () => {
    const fetchMock = stubFetch(metrics);

    await getMetrics({ from: '2026-09-01', to: '2026-09-30' });

    expect(lastUrl(fetchMock)).toBe(
      'http://api.local/admin/metrics?from=2026-09-01&to=2026-09-30',
    );
  });

  it('aceita tudo que a API devolve, inclusive e-mail nulo e taxas nulas', async () => {
    stubFetch({
      ...metrics,
      lessons: { ...metrics.lessons, completionRate: null },
      retention: [
        {
          cohortWeek: '2026-09-28',
          size: 0,
          weeks: [{ offset: 0, retained: 0, rate: null }],
        },
      ],
    });

    const result = await getMetrics();

    expect(result.lessons.completionRate).toBeNull();
    expect(result.retention[0]?.weeks[0]?.rate).toBeNull();
    expect(result.aiCost.topUsers[0]?.email).toBeNull();
  });
});
