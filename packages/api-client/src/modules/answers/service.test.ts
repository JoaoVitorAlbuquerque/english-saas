import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { submitAnswer } from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const answerResultFixture = {
  answerId: 'answer-1',
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Boa!',
  explanation: 'Explicação.',
  correctAnswer: { optionIds: ['am'], texts: ['am'] },
  errorPatterns: [],
  isFirstTry: true,
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('submitAnswer', () => {
  it('envia a resposta de lição (com attemptId) e devolve o feedback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(answerResultFixture));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitAnswer({
      itemId: 'item-1',
      attemptId: 'attempt-1',
      context: 'LESSON',
      response: { optionIds: ['am'] },
      responseTimeMs: 2_000,
      hintsUsed: 0,
    });

    expect(result.isCorrect).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/answers',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('envia prática de ponto fraco (TARGETED_PRACTICE) sem attemptId', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(answerResultFixture));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitAnswer({
      itemId: 'item-1',
      context: 'TARGETED_PRACTICE',
      response: { optionIds: ['am'] },
      responseTimeMs: 2_000,
      hintsUsed: 0,
    });

    expect(result.isCorrect).toBe(true);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).not.toHaveProperty('attemptId');
  });
});
