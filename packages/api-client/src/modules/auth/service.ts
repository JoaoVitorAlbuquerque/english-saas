import { z } from 'zod';

import { apiFetch } from '../../http/fetch-client';
import { readCsrfCookie } from '../../http/csrf-cookie';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  sessionResponseSchema,
  signinRequestSchema,
  signupRequestSchema,
  type SessionResponse,
  type SigninRequest,
  type SignupRequest,
} from './schemas';

export async function signin(input: SigninRequest): Promise<SessionResponse> {
  const body = signinRequestSchema.parse(input);
  const session = await apiFetch('/auth/signin', {
    method: 'POST',
    body,
    schema: sessionResponseSchema,
    isPublic: true,
  });

  setAccessToken(session.accessToken);

  return session;
}

export async function signup(input: SignupRequest): Promise<SessionResponse> {
  const body = signupRequestSchema.parse(input);
  const session = await apiFetch('/auth/signup', {
    method: 'POST',
    body,
    schema: sessionResponseSchema,
    isPublic: true,
  });

  setAccessToken(session.accessToken);

  return session;
}

export async function logout(): Promise<void> {
  const csrfToken = readCsrfCookie();

  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      schema: z.void(),
      isPublic: true,
      extraHeaders: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
    });
  } finally {
    clearAccessToken();
  }
}

export async function logoutAll(): Promise<void> {
  try {
    await apiFetch('/auth/logout-all', { method: 'POST', schema: z.void() });
  } finally {
    clearAccessToken();
  }
}
