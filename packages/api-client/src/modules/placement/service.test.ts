import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { answer, latest, start } from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const inProgressState = {
  id: 'test-1',
  status: 'IN_PROGRESS',
  answered: 0,
  maxItems: 30,
  next: {
    id: 'item-1',
    type: 'MULTIPLE_CHOICE',
    prompt: 'Complete: I ___ Maya.',
    content: {
      options: [
        { id: 'am', text: 'am' },
        { id: 'is', text: 'is' },
      ],
      shuffle: false,
    },
    cefrLevel: 'A1',
    skillIds: ['grammar.be.present.affirmative'],
    assets: {},
  },
  result: null,
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('start', () => {
  it('começa (ou retoma) o teste e devolve a primeira questão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(inProgressState));
    vi.stubGlobal('fetch', fetchMock);

    const state = await start();

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.next?.id).toBe('item-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/placement/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('answer', () => {
  it('envia a resposta e devolve o próximo estado', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...inProgressState, answered: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const state = await answer('test-1', {
      itemId: 'item-1',
      response: { optionIds: ['am'] },
      responseTimeMs: 4_000,
      clientAnswerId: 'client-answer-1',
    });

    expect(state.answered).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/placement/test-1/answer',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('latest', () => {
  it('devolve o resultado quando o teste já terminou', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'test-1',
          status: 'COMPLETED',
          answered: 12,
          maxItems: 30,
          next: null,
          result: {
            overallLevel: 'B1',
            label: 'Intermediário',
            competencies: [
              {
                competency: 'GRAMMAR',
                label: 'Gramática',
                level: 'B1',
                items: 3,
              },
            ],
            masteredSkillIds: ['grammar.be.present.affirmative'],
            note: null,
            writingStatus: 'NOT_OFFERED',
            completedAt: new Date().toISOString(),
            nextAvailableAt: new Date(
              Date.now() + 60 * 86_400_000,
            ).toISOString(),
          },
        }),
      ),
    );

    const state = await latest();

    expect(state.result?.overallLevel).toBe('B1');
    expect(state.result?.nextAvailableAt).not.toBeNull();
  });
});
