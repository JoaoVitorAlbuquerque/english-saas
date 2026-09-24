import { randomBytes } from 'node:crypto';

import type { CookieOptions, Response } from 'express';

import type { EnvService } from 'src/common/config/env.service';

export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/** Só o refresh chega nestas rotas — o cookie não viaja no resto da API. */
export const REFRESH_COOKIE_PATH = '/auth';

function baseOptions(envService: EnvService): CookieOptions {
  const domain = envService.get('AUTH_COOKIE_DOMAIN');

  return {
    // Domínio pai (`.exemplo.com.br`) para o cookie valer entre `app.` e
    // `api.`. Em localhost fica ausente: o browser recusa domínio sem ponto.
    ...(domain === undefined ? {} : { domain }),
    secure: envService.get('AUTH_COOKIE_SECURE'),
    sameSite: envService.get('AUTH_COOKIE_SAME_SITE'),
    path: REFRESH_COOKIE_PATH,
  };
}

/**
 * Grava o refresh token (httpOnly) e o token CSRF (legível).
 *
 * O access token **não** vira cookie: ele volta no corpo e o front guarda em
 * memória. Assim um XSS não encontra sessão persistida para roubar.
 */
export function setAuthCookies(
  response: Response,
  envService: EnvService,
  input: { refreshToken: string; expiresAt: Date },
): string {
  const options = baseOptions(envService);
  const csrfToken = randomBytes(24).toString('base64url');

  response.cookie(REFRESH_COOKIE, input.refreshToken, {
    ...options,
    httpOnly: true,
    expires: input.expiresAt,
  });

  // Legível de propósito: o front precisa copiar para o header.
  response.cookie(CSRF_COOKIE, csrfToken, {
    ...options,
    httpOnly: false,
    expires: input.expiresAt,
  });

  return csrfToken;
}

export function clearAuthCookies(
  response: Response,
  envService: EnvService,
): void {
  const options = baseOptions(envService);

  response.clearCookie(REFRESH_COOKIE, { ...options, httpOnly: true });
  response.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

export function readRefreshCookie(cookies: unknown): string | undefined {
  const value = (cookies as Record<string, unknown> | undefined)?.[
    REFRESH_COOKIE
  ];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
