import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { answerCheckpoint, startCheckpoint } from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const itemFixture = {
  id: 'item-1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Complete: She ___ from Brazil.',
  content: { options: ['is', 'are'] },
  cefrLevel: 'A1',
  skillIds: ['grammar.be.present.affirmative'],
  assets: {},
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('startCheckpoint', () => {
  it('começa (ou retoma) o checkpoint da unidade', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'checkpoint-1',
        unitId: 'unit-1',
        status: 'IN_PROGRESS',
        answered: 0,
        maxItems: 8,
        next: itemFixture,
        result: null,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = await startCheckpoint('unit-1');

    expect(state.next?.id).toBe('item-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/checkpoints/unit-1/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('answerCheckpoint', () => {
  it('responde e devolve o resultado quando termina', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'checkpoint-1',
        unitId: 'unit-1',
        status: 'COMPLETED',
        answered: 8,
        maxItems: 8,
        next: null,
        result: {
          result: 'PASSED',
          message: 'Tudo certo com esta unidade. Pode seguir.',
          score: 0.9,
          reinforce: [],
          completedAt: '2026-09-29T12:00:00.000Z',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = await answerCheckpoint('checkpoint-1', {
      itemId: 'item-1',
      response: { optionIds: ['opt-1'] },
      responseTimeMs: 2_000,
    });

    expect(state.result).toMatchObject({ result: 'PASSED' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/checkpoints/checkpoint-1/answer',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
