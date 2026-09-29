import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { getStats } from './service';

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
