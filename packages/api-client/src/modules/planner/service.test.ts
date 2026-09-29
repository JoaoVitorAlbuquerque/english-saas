import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  completeAgendaBlock,
  getAgenda,
  getForecast,
  getPlan,
  rebuildPlan,
  skipAgendaBlock,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const planFixture = {
  targetLevel: 'C1',
  targetDate: null,
  path: [
    {
      lessonId: 'lesson-1',
      slug: 'nice-to-meet-you',
      unitId: 'unit-1',
      title: 'Nice to meet you',
      cefrLevel: 'A1',
      estimatedMinutes: 15,
      order: 0,
      reason: 'Próxima do plano.',
    },
  ],
  reinforceSkillIds: [],
  forecast: {
    estimatedArrival: '2027-01-01',
    weeksNeeded: 40,
    realistic: true,
    message: null,
  },
  version: 3,
};

const agendaFixture = {
  localDate: '2026-09-28',
  generatedAt: new Date().toISOString(),
  minutesCompleted: 0,
  blocks: [
    {
      id: 'review',
      type: 'REVIEW',
      refId: 'review',
      estimatedMinutes: 5,
      reason: '3 cards vencidos.',
      count: 3,
      status: 'PENDING',
    },
  ],
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('getPlan', () => {
  it('busca o plano completo, com forecast e reforço', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(planFixture));
    vi.stubGlobal('fetch', fetchMock);

    const plan = await getPlan();

    expect(plan.version).toBe(3);
    expect(plan.forecast?.weeksNeeded).toBe(40);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/plan',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('rebuildPlan', () => {
  it('refaz o plano do zero', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...planFixture, version: 4 }));
    vi.stubGlobal('fetch', fetchMock);

    const plan = await rebuildPlan();

    expect(plan.version).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/plan/rebuild',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('getForecast', () => {
  it('busca a previsão e o aviso de ritmo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        forecast: planFixture.forecast,
        weeksBehind: 1.5,
        message: 'Você está atrás do ritmo esperado.',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const status = await getForecast();

    expect(status.weeksBehind).toBe(1.5);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/plan/forecast',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getAgenda', () => {
  it('busca a agenda de hoje', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(agendaFixture));
    vi.stubGlobal('fetch', fetchMock);

    const agenda = await getAgenda();

    expect(agenda.blocks[0]?.status).toBe('PENDING');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/agenda',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('skipAgendaBlock', () => {
  it('pula um bloco com motivo e nota', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...agendaFixture,
        blocks: [
          {
            ...agendaFixture.blocks[0],
            status: 'SKIPPED',
            skipReason: 'OTHER',
            skipNote: 'Já revisei ontem',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const agenda = await skipAgendaBlock('review', {
      reason: 'OTHER',
      note: 'Já revisei ontem',
    });

    expect(agenda.blocks[0]).toMatchObject({
      status: 'SKIPPED',
      skipNote: 'Já revisei ontem',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/agenda/blocks/review/skip',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('completeAgendaBlock', () => {
  it('conclui um bloco e soma os minutos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...agendaFixture,
        minutesCompleted: 5,
        blocks: [
          { ...agendaFixture.blocks[0], status: 'COMPLETED', minutesSpent: 5 },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const agenda = await completeAgendaBlock('review', { minutesSpent: 5 });

    expect(agenda.minutesCompleted).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/agenda/blocks/review/complete',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
