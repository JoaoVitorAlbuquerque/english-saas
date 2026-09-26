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
  acceptedTerms: z.literal(true),
  acceptedPrivacyPolicy: z.literal(true),
  acceptedDataPersonalization: z.boolean().default(false),
  acceptedMarketing: z.boolean().default(false),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
});

export const sessionResponseSchema = z.object({
  user: sessionUserSchema,
  accessToken: z.string(),
  csrfToken: z.string(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
