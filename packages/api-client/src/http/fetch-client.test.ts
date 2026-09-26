import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { apiFetch } from './fetch-client';
import { configureApiClient } from './config';
import { subscribeApiClientEvents } from './events';
import { setAccessToken, clearAccessToken } from './token-store';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('injeta o Authorization e valida a resposta pelo schema', async () => {
    setAccessToken('token-123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/me', {
      schema: z.object({ ok: z.boolean() }),
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    );
  });

  it('em 401 tenta o refresh e repete a chamada original uma vez', async () => {
    setAccessToken('expired');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'UNAUTHORIZED', message: 'Expirado.' } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          user: { id: '1', name: 'Aluno', email: 'a@a.com', role: 'STUDENT' },
          accessToken: 'refreshed-token',
          csrfToken: 'csrf',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/me', {
      schema: z.object({ ok: z.boolean() }),
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('emite plan-required quando a API recusa por plano', async () => {
    const events: string[] = [];
    const unsubscribe = subscribeApiClientEvents((event) =>
      events.push(event.type),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'PLAN_REQUIRED',
              message: 'Assine o Plus.',
              details: { requiredPlan: 'PLUS' },
            },
          },
          { status: 403 },
        ),
      ),
    );

    await expect(
      apiFetch('/me/materials', { schema: z.unknown(), isPublic: true }),
    ).rejects.toMatchObject({ code: 'PLAN_REQUIRED' });

    expect(events).toContain('plan-required');
    unsubscribe();
  });
});
