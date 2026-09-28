import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, getAccessToken } from '../../http/token-store';
import {
  forgotPassword,
  getGoogleUrl,
  resendVerification,
  resetPassword,
  signinWithGoogle,
  verifyEmail,
} from './service';

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

describe('forgotPassword', () => {
  it('sempre responde ok, exista ou não a conta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sent: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      forgotPassword({ email: 'aluno@exemplo.com' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/auth/forgot-password',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('resetPassword', () => {
  it('propaga INVALID_TOKEN quando o link expirou', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'INVALID_TOKEN', message: 'Link expirado.' } },
            { status: 400 },
          ),
        ),
    );

    await expect(
      resetPassword({ token: 'expirado', password: 'nova-senha-123' }),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('resolve quando o token é válido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ reset: true })),
    );

    await expect(
      resetPassword({ token: 'valido', password: 'nova-senha-123' }),
    ).resolves.toBeUndefined();
  });
});

describe('verifyEmail e resendVerification', () => {
  it('confirma o e-mail com um token válido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ verified: true })),
    );

    await expect(verifyEmail({ token: 'abc' })).resolves.toBeUndefined();
  });

  it('reenvia a verificação', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sent: true }));
    vi.stubGlobal('fetch', fetchMock);

    await resendVerification({ email: 'aluno@exemplo.com' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/auth/resend-verification',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('Google', () => {
  it('busca a URL de autorização', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          url: 'https://accounts.google.com/...',
          state: 'xyz',
        }),
      ),
    );

    const result = await getGoogleUrl();

    expect(result.url).toContain('google.com');
  });

  it('troca code+state pela sessão e guarda o access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          user: {
            id: '1',
            name: 'Aluno',
            email: 'a@a.com',
            role: 'STUDENT',
            emailVerifiedAt: new Date().toISOString(),
          },
          accessToken: 'google-token',
          csrfToken: 'csrf',
        }),
      ),
    );

    const session = await signinWithGoogle({ code: 'abc', state: 'xyz' });

    expect(session.user.emailVerifiedAt).not.toBeNull();
    expect(getAccessToken()).toBe('google-token');
  });
});
