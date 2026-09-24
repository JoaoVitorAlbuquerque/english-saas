import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../domain/password';

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH);

export class SignupDto extends createZodDto(
  z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(255),
    password: passwordSchema,
    /** Termos e política são obrigatórios para criar a conta (LGPD). */
    acceptedTerms: z.literal(true),
    acceptedPrivacyPolicy: z.literal(true),
    /** Opcionais: o aluno escolhe. */
    acceptedDataPersonalization: z.boolean().default(false),
    acceptedMarketing: z.boolean().default(false),
  }),
) {}

export class SigninDto extends createZodDto(
  z.object({
    email: z.email().max(255),
    password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  }),
) {}

export class VerifyEmailDto extends createZodDto(
  z.object({ token: z.string().min(1).max(512) }),
) {}

export class ResendVerificationDto extends createZodDto(
  z.object({ email: z.email().max(255) }),
) {}

export class ForgotPasswordDto extends createZodDto(
  z.object({ email: z.email().max(255) }),
) {}

export class ResetPasswordDto extends createZodDto(
  z.object({
    token: z.string().min(1).max(512),
    password: passwordSchema,
  }),
) {}

export class GoogleCallbackDto extends createZodDto(
  z.object({
    code: z.string().min(1).max(2048),
    state: z.string().min(1).max(512),
  }),
) {}
