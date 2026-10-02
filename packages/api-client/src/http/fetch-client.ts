import type { z } from 'zod';

import { getApiBaseUrl } from './config';
import { emitApiClientEvent } from './events';
import { ApiError, networkApiError, parseErrorResponse } from './api-error';
import { refreshSession } from './refresh-queue';
import { getAccessToken } from './token-store';

export type ApiFetchOptions<T> = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  schema: z.ZodType<T>;
  /** Rota que não exige access token e nunca tenta refresh em 401 (ex.: signin). */
  isPublic?: boolean;
  /** Cabeçalhos extras — ex.: `x-csrf-token` nas rotas protegidas por CsrfGuard. */
  extraHeaders?: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * Cliente HTTP único do front. Toda resposta é validada com `schema.parse` —
 * a mesma regra do back-end de nunca usar JSON "na fé", agora do lado do
 * cliente.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions<T>,
): Promise<T> {
  return performRequest(path, options, true);
}

async function performRequest<T>(
  path: string,
  options: ApiFetchOptions<T>,
  allowRetry: boolean,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: buildHeaders(options),
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw networkApiError();
  }

  if (response.status === 401 && !options.isPublic && allowRetry) {
    await refreshSession().catch(() => {
      throw new ApiError({
        code: 'UNAUTHENTICATED',
        message: 'Sua sessão expirou. Entre de novo.',
        status: 401,
      });
    });

    return performRequest(path, options, false);
  }

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    handleGlobalErrorCodes(error);
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // O Nest responde `return null` com 200 e corpo vazio (ex.: `GET /me/export`
  // sem nenhum export ainda). Corpo vazio vale `null`: quem aceita ausência
  // declara `nullable()` no schema; para os demais, o `parse` recusa.
  const text = await response.text();
  const json: unknown = text === '' ? null : JSON.parse(text);

  return options.schema.parse(json);
}

function buildHeaders(options: ApiFetchOptions<unknown>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.extraHeaders,
  };

  if (!options.isPublic) {
    const token = getAccessToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

function handleGlobalErrorCodes(error: ApiError): void {
  if (error.code === 'PLAN_REQUIRED') {
    const details = error.details as { requiredPlan?: string } | undefined;
    emitApiClientEvent({
      type: 'plan-required',
      requiredPlan: details?.requiredPlan,
      error,
    });
    return;
  }

  if (error.code === 'INSUFFICIENT_AI_CREDITS') {
    emitApiClientEvent({ type: 'insufficient-credits', error });
  }
}
