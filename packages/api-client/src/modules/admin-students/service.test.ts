import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  getStudent,
  getStudentAiUsage,
  getStudentCreditHistory,
  getStudentCredits,
  getStudentHistory,
  getStudentPlan,
  getStudentProgress,
  getStudentSubscription,
  listUsers,
} from './service';

const ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Uma `Response` nova a cada chamada: o corpo só se lê uma vez. */
function stubFetch(body: unknown) {
  const fetchMock = vi
    .fn()
    .mockImplementation(() => Promise.resolve(jsonResponse(body)));

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function lastUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  return (fetchMock.mock.calls.at(-1) as [string])[0];
}

const userRow = {
  id: ID,
  email: 'ana@exemplo.com',
  name: 'Ana Lima',
  role: 'STUDENT',
  emailVerifiedAt: null,
  deletedAt: null,
  anonymizedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('busca de alunos', () => {
  it('manda a busca e o cursor; texto vazio some da query', async () => {
    const fetchMock = stubFetch({
      data: [userRow],
      nextCursor: 'abc',
      hasMore: true,
    });

    const page = await listUsers({ q: 'ana lima', limit: 25 });

    expect(page.data[0]?.name).toBe('Ana Lima');
    expect(lastUrl(fetchMock)).toBe(
      'http://api.local/admin/users?q=ana+lima&limit=25',
    );

    await listUsers({ q: '', cursor: 'abc' });
    expect(lastUrl(fetchMock)).toBe('http://api.local/admin/users?cursor=abc');
  });
});

describe('ficha do aluno', () => {
  it('lê conta, perfil e interesses; perfil pode ser null', async () => {
    const fetchMock = stubFetch({
      user: userRow,
      profile: null,
      interests: [],
    });

    const overview = await getStudent(ID);

    expect(overview.profile).toBeNull();
    expect(lastUrl(fetchMock)).toBe(`http://api.local/admin/users/${ID}`);
  });

  it('plano ausente chega como null, sem erro', async () => {
    stubFetch({ plan: null, pace: null });

    await expect(getStudentPlan(ID)).resolves.toEqual({
      plan: null,
      pace: null,
    });
  });

  it('cada seção usa a própria rota e a paginação leva o cursor', async () => {
    const page = { data: [], nextCursor: null, hasMore: false };
    const fetchMock = stubFetch(page);

    await getStudentHistory(ID, 'c1');
    expect(lastUrl(fetchMock)).toBe(
      `http://api.local/admin/users/${ID}/history?cursor=c1&limit=20`,
    );

    await getStudentCreditHistory(ID);
    expect(lastUrl(fetchMock)).toBe(
      `http://api.local/admin/users/${ID}/credits/history?limit=20`,
    );
  });

  it('créditos, assinatura, uso de IA e progresso', async () => {
    const fetchMock = stubFetch({
      tier: 'FREE',
      balance: 10,
      monthlyAiCredits: 10,
      costs: { TUTOR_CORRECTION: 1 },
      nextGrantAt: '2026-11-01T00:05:00.000Z',
    });
    await expect(getStudentCredits(ID)).resolves.toMatchObject({ balance: 10 });
    expect(lastUrl(fetchMock)).toBe(
      `http://api.local/admin/users/${ID}/credits`,
    );

    stubFetch({ tier: 'FREE', message: 'Plano gratuito', subscription: null });
    await expect(getStudentSubscription(ID)).resolves.toMatchObject({
      tier: 'FREE',
    });

    const usage = stubFetch({
      totals: {
        calls: 2,
        inputTokens: 10,
        outputTokens: 5,
        costUsdMicros: 900,
      },
      byFeature: [
        {
          feature: 'tutor-correction',
          calls: 2,
          inputTokens: 10,
          outputTokens: 5,
          costUsdMicros: 900,
        },
      ],
    });
    await expect(getStudentAiUsage(ID)).resolves.toMatchObject({
      totals: { costUsdMicros: 900 },
    });
    expect(lastUrl(usage)).toBe(`http://api.local/admin/users/${ID}/ai-usage`);

    const progress = stubFetch({});
    await expect(getStudentProgress(ID, 8)).rejects.toThrow();
    expect(lastUrl(progress)).toBe(
      `http://api.local/admin/users/${ID}/progress?weeks=8`,
    );
  });
});
