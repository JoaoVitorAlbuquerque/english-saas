import { getApiBaseUrl } from './config';
import { readCsrfCookie } from './csrf-cookie';
import { emitApiClientEvent } from './events';
import { parseErrorResponse } from './api-error';
import { setAccessToken } from './token-store';
import {
  sessionResponseSchema,
  type SessionResponse,
} from '../modules/auth/schemas';

let inFlight: Promise<SessionResponse> | null = null;

/**
 * Troca o refresh token do cookie por um access token novo. Concorrência:
 * se várias respostas 401 chegarem juntas, todas esperam a mesma promessa —
 * só sai uma chamada de verdade para `/auth/refresh`.
 */
export function refreshSession(): Promise<SessionResponse> {
  if (inFlight) {
    return inFlight;
  }

  inFlight = performRefresh().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function performRefresh(): Promise<SessionResponse> {
  const csrfToken = readCsrfCookie();

  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
  });

  if (!response.ok) {
    setAccessToken(null);
    emitApiClientEvent({ type: 'unauthenticated' });
    throw await parseErrorResponse(response);
  }

  const body: unknown = await response.json();
  const session = sessionResponseSchema.parse(body);

  setAccessToken(session.accessToken);

  return session;
}
