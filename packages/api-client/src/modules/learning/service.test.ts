import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { getRecentHistory, getStats } from './service';

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

describe('getStats', () => {
  it('busca XP total e sequência do aluno', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        totalXp: 88,
        currentStreak: 3,
        longestStreak: 5,
        lastStudyDate: '2026-09-28',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const stats = await getStats();

    expect(stats).toMatchObject({ totalXp: 88, currentStreak: 3 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/stats',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

const historyEntry = {
  attemptId: 'attempt-1',
  lessonId: 'lesson-1',
  lessonSlug: 'nice-to-meet-you',
  title: 'Nice to meet you',
  cefrLevel: 'A1',
  version: 1,
  status: 'COMPLETED',
  source: 'PLAN',
  currentStepIndex: 6,
  xpEarned: 30,
  startedAt: '2026-09-28T10:00:00.000Z',
  completedAt: '2026-09-28T10:20:00.000Z',
};

describe('getRecentHistory', () => {
  it('junta as páginas até acabar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [historyEntry],
          nextCursor: 'cursor-1',
          hasMore: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ ...historyEntry, attemptId: 'attempt-2' }],
          nextCursor: null,
          hasMore: false,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const entries = await getRecentHistory();

    expect(entries).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('para no teto de páginas mesmo se ainda tiver mais', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          data: [historyEntry],
          nextCursor: 'cursor-x',
          hasMore: true,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const entries = await getRecentHistory(2);

    expect(entries).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
