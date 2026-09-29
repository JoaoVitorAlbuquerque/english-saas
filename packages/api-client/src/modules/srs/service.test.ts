import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { answerReviewCard, getReviewSession } from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('getReviewSession', () => {
  it('busca a sessão de revisão com item e flashcard', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          cardId: 'card-1',
          kind: 'SKILL',
          due: new Date().toISOString(),
          exercise: {
            type: 'ITEM',
            item: {
              id: 'item-1',
              type: 'MULTIPLE_CHOICE',
              prompt: 'I ___ Lucas.',
              content: { options: [], shuffle: false },
              cefrLevel: 'A1',
              skillIds: ['grammar.be'],
              assets: {},
            },
          },
        },
        {
          cardId: 'card-2',
          kind: 'VOCAB',
          due: new Date().toISOString(),
          exercise: { type: 'FLASHCARD', front: 'hello', back: 'olá' },
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await getReviewSession(10);

    expect(session).toHaveLength(2);
    expect(session[0]?.exercise.type).toBe('ITEM');
    expect(session[1]?.exercise).toMatchObject({
      type: 'FLASHCARD',
      front: 'hello',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/reviews/session?minutes=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('answerReviewCard', () => {
  it('responde card de SKILL e recebe a correção completa junto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        cardId: 'card-1',
        rating: 'GOOD',
        nextDueAt: new Date().toISOString(),
        state: 'REVIEW',
        answer: {
          answerId: 'answer-1',
          isCorrect: true,
          score: 1,
          verdict: 'CORRECT',
          feedback: 'Boa!',
          explanation: 'Explicação.',
          correctAnswer: { optionIds: ['am'], texts: ['am'] },
          errorPatterns: [],
          isFirstTry: true,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await answerReviewCard('card-1', {
      kind: 'ITEM',
      itemId: 'item-1',
      response: { optionIds: ['am'] },
      responseTimeMs: 2_000,
    });

    expect(result.rating).toBe('GOOD');
    expect(result.answer?.isCorrect).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/reviews/card-1/answer',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('responde flashcard com self-rating, sem correção', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        cardId: 'card-2',
        rating: 'EASY',
        nextDueAt: new Date().toISOString(),
        state: 'REVIEW',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await answerReviewCard('card-2', {
      kind: 'SELF_RATING',
      selfRating: 'EASY',
    });

    expect(result.answer).toBeUndefined();
  });
});
