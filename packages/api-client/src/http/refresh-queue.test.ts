import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from './config';
import { clearAccessToken, getAccessToken } from './token-store';
import { refreshSession } from './refresh-queue';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  document.cookie = 'csrf_token=csrf-abc';
});

afterEach(() => {
  clearAccessToken();
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  vi.unstubAllGlobals();
});

const session = {
  user: {
    id: '1',
    name: 'Aluno',
    email: 'aluno@exemplo.com',
    role: 'STUDENT',
    emailVerifiedAt: null,
  },
  accessToken: 'new-access-token',
  csrfToken: 'csrf-abc',
};

describe('refreshSession', () => {
  it('faz uma única chamada a /auth/refresh mesmo com pedidos concorrentes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(session));
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      refreshSession(),
      refreshSession(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': 'csrf-abc' },
      }),
    );
    expect(first.accessToken).toBe('new-access-token');
    expect(second.accessToken).toBe('new-access-token');
    expect(getAccessToken()).toBe('new-access-token');
  });

  it('limpa o token quando o refresh falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'UNAUTHORIZED', message: 'Sessão expirada.' } },
            { status: 401 },
          ),
        ),
    );

    await expect(refreshSession()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(getAccessToken()).toBeNull();
  });
});
