import { randomBytes } from 'node:crypto';

import type { CookieOptions, Response } from 'express';

import type { EnvService } from 'src/common/config/env.service';

export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/** Só o refresh chega nestas rotas — o cookie não viaja no resto da API. */
export const REFRESH_COOKIE_PATH = '/auth';

/**
 * O CSRF precisa ser lido por `document.cookie` de qualquer rota do front
 * (o SPA quase nunca está em `/auth/*`) — `Path` de cookie restringe tanto o
 * envio automático quanto a leitura por JS ao path *do documento atual*, não
 * ao da rota de destino. Preso a `/auth`, o front nunca conseguia ler o
 * cookie fora da tela de callback do Google, e todo refresh (inclusive o do
 * reload de página) caía no `CsrfTokenMismatchError`.
 */
export const CSRF_COOKIE_PATH = '/';

/**
 * Path em que o CSRF nascia antes. Um cookie com path diferente é outro
 * cookie: o antigo continua no browser e, em `/auth/*`, é enviado antes do
 * novo. Toda gravação/limpeza apaga ele até o último expirar (30 dias).
 */
const LEGACY_CSRF_COOKIE_PATH = '/auth';

function baseOptions(envService: EnvService, path: string): CookieOptions {
  const domain = envService.get('AUTH_COOKIE_DOMAIN');

  return {
    // Domínio pai (`.exemplo.com.br`) para o cookie valer entre `app.` e
    // `api.`. Em localhost fica ausente: o browser recusa domínio sem ponto.
    ...(domain === undefined ? {} : { domain }),
    secure: envService.get('AUTH_COOKIE_SECURE'),
    sameSite: envService.get('AUTH_COOKIE_SAME_SITE'),
    path,
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
  const csrfToken = randomBytes(24).toString('base64url');

  clearLegacyCsrfCookie(response, envService);
  response.cookie(REFRESH_COOKIE, input.refreshToken, {
    ...baseOptions(envService, REFRESH_COOKIE_PATH),
    httpOnly: true,
    expires: input.expiresAt,
  });

  // Legível de propósito: o front precisa copiar para o header.
  response.cookie(CSRF_COOKIE, csrfToken, {
    ...baseOptions(envService, CSRF_COOKIE_PATH),
    httpOnly: false,
    expires: input.expiresAt,
  });

  return csrfToken;
}

export function clearAuthCookies(
  response: Response,
  envService: EnvService,
): void {
  response.clearCookie(REFRESH_COOKIE, {
    ...baseOptions(envService, REFRESH_COOKIE_PATH),
    httpOnly: true,
  });
  response.clearCookie(CSRF_COOKIE, {
    ...baseOptions(envService, CSRF_COOKIE_PATH),
    httpOnly: false,
  });
  clearLegacyCsrfCookie(response, envService);
}

function clearLegacyCsrfCookie(
  response: Response,
  envService: EnvService,
): void {
  response.clearCookie(CSRF_COOKIE, {
    ...baseOptions(envService, LEGACY_CSRF_COOKIE_PATH),
    httpOnly: false,
  });
}

/**
 * Todos os valores de `csrf_token` do header `Cookie` cru. O `cookie-parser`
 * fica só com o primeiro, e com o cookie legado ainda no browser o primeiro é
 * justamente o velho.
 */
export function readCsrfCookieValues(rawCookieHeader: unknown): string[] {
  if (typeof rawCookieHeader !== 'string') {
    return [];
  }

  const prefix = `${CSRF_COOKIE}=`;

  return (
    rawCookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith(prefix))
      // base64url: nunca vem codificado, e decodificar lixo lançaria.
      .map((part) => part.slice(prefix.length))
      .filter((value) => value.length > 0)
  );
}

export function readRefreshCookie(cookies: unknown): string | undefined {
  const value = (cookies as Record<string, unknown> | undefined)?.[
    REFRESH_COOKIE
  ];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
