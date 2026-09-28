import { roleSchema } from '@english-saas/shared';
import { z } from 'zod';

/**
 * Espelha as DTOs de `apps/api/src/modules/auth/dto/auth.dto.ts` — elas não
 * são exportadas por `packages/shared`, então o contrato vive aqui até que
 * passem a ser compartilhadas.
 */
export const signinRequestSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});
export type SigninRequest = z.infer<typeof signinRequestSchema>;

export const signupRequestSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  // boolean (não `z.literal(true)`) para o form conseguir nascer com `false`
  // controlado — um checkbox controlado que começa em `undefined` gera aviso
  // de "uncontrolled to controlled" no React.
  acceptedTerms: z.boolean().refine((value) => value, {
    message: 'Você precisa aceitar os termos de uso.',
  }),
  acceptedPrivacyPolicy: z.boolean().refine((value) => value, {
    message: 'Você precisa aceitar a política de privacidade.',
  }),
  acceptedDataPersonalization: z.boolean().default(false),
  acceptedMarketing: z.boolean().default(false),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const resendVerificationRequestSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
});
export type ResendVerificationRequest = z.infer<
  typeof resendVerificationRequestSchema
>;

export const googleCallbackRequestSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type GoogleCallbackRequest = z.infer<typeof googleCallbackRequestSchema>;

export const googleUrlResponseSchema = z.object({
  url: z.string(),
  state: z.string(),
});
export type GoogleUrlResponse = z.infer<typeof googleUrlResponseSchema>;

const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
  emailVerifiedAt: z.string().nullable(),
});

export const sessionResponseSchema = z.object({
  user: sessionUserSchema,
  accessToken: z.string(),
  csrfToken: z.string(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
