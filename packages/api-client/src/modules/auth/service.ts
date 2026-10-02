import { z } from 'zod';

import { apiFetch } from '../../http/fetch-client';
import { readCsrfCookie } from '../../http/csrf-cookie';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  forgotPasswordRequestSchema,
  googleCallbackRequestSchema,
  googleUrlResponseSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  sessionResponseSchema,
  signinRequestSchema,
  signupRequestSchema,
  verifyEmailRequestSchema,
  type ForgotPasswordRequest,
  type GoogleCallbackRequest,
  type GoogleUrlResponse,
  type ResendVerificationRequest,
  type ResetPasswordRequest,
  type SessionResponse,
  type SigninRequest,
  type SignupRequest,
  type VerifyEmailRequest,
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
    // A API responde 200 com `{ revoked }` (quantas sessões encerrou), não 204.
    await apiFetch('/auth/logout-all', {
      method: 'POST',
      schema: z.object({ revoked: z.number() }),
    });
  } finally {
    clearAccessToken();
  }
}

export async function forgotPassword(
  input: ForgotPasswordRequest,
): Promise<void> {
  const body = forgotPasswordRequestSchema.parse(input);
  await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body,
    schema: z.object({ sent: z.literal(true) }),
    isPublic: true,
  });
}

export async function resetPassword(
  input: ResetPasswordRequest,
): Promise<void> {
  const body = resetPasswordRequestSchema.parse(input);
  await apiFetch('/auth/reset-password', {
    method: 'POST',
    body,
    schema: z.object({ reset: z.literal(true) }),
    isPublic: true,
  });
}

export async function verifyEmail(input: VerifyEmailRequest): Promise<void> {
  const body = verifyEmailRequestSchema.parse(input);
  await apiFetch('/auth/verify-email', {
    method: 'POST',
    body,
    schema: z.object({ verified: z.literal(true) }),
    isPublic: true,
  });
}

export async function resendVerification(
  input: ResendVerificationRequest,
): Promise<void> {
  const body = resendVerificationRequestSchema.parse(input);
  await apiFetch('/auth/resend-verification', {
    method: 'POST',
    body,
    schema: z.object({ sent: z.literal(true) }),
    isPublic: true,
  });
}

export async function getGoogleUrl(): Promise<GoogleUrlResponse> {
  return apiFetch('/auth/google/url', {
    schema: googleUrlResponseSchema,
    isPublic: true,
  });
}

export async function signinWithGoogle(
  input: GoogleCallbackRequest,
): Promise<SessionResponse> {
  const body = googleCallbackRequestSchema.parse(input);
  const session = await apiFetch('/auth/google/callback', {
    method: 'POST',
    body,
    schema: sessionResponseSchema,
    isPublic: true,
  });

  setAccessToken(session.accessToken);

  return session;
}
