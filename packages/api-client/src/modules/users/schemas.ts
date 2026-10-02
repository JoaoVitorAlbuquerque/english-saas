import {
  availabilityMinutesSchema,
  consentTypeSchema,
  interestSchema,
  learningGoalSchema,
  preferredStudyTimeSchema,
  selfReportedLevelSchema,
} from '@english-saas/shared';
import { z } from 'zod';

/**
 * Espelha `apps/api/src/modules/users/dto/users.dto.ts` e o retorno de
 * `UsersService` — não estão em `packages/shared`, então o contrato vive
 * aqui até que passem a ser compartilhados.
 */
export const studentProfileSchema = z.object({
  userId: z.string(),
  goals: z.array(learningGoalSchema),
  goalNote: z.string().nullable(),
  availabilityMinutes: availabilityMinutesSchema,
  preferredStudyTime: preferredStudyTimeSchema,
  targetDate: z.string().nullable(),
  selfReportedLevel: selfReportedLevelSchema,
  timezone: z.string(),
  nativeLanguage: z.string(),
  onboardingCompletedAt: z.string().nullable(),
});
export type StudentProfile = z.infer<typeof studentProfileSchema>;

export const completeOnboardingRequestSchema = z.object({
  goals: z.array(learningGoalSchema).min(1, 'Escolha pelo menos um objetivo.'),
  goalNote: z.string().trim().max(500).nullable().optional(),
  availabilityMinutes: availabilityMinutesSchema.partial(),
  preferredStudyTime: preferredStudyTimeSchema.optional(),
  selfReportedLevel: selfReportedLevelSchema,
  interests: z.array(interestSchema).default([]),
});
export type CompleteOnboardingRequest = z.infer<
  typeof completeOnboardingRequestSchema
>;

export const completeOnboardingResponseSchema = studentProfileSchema.extend({
  interests: z.array(interestSchema),
});
export type CompleteOnboardingResponse = z.infer<
  typeof completeOnboardingResponseSchema
>;

export const updateConsentRequestSchema = z.object({
  type: consentTypeSchema,
  granted: z.boolean(),
});
export type UpdateConsentRequest = z.infer<typeof updateConsentRequestSchema>;

export const consentViewSchema = z.object({
  type: consentTypeSchema,
  version: z.string(),
  granted: z.boolean(),
  grantedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  upToDate: z.boolean(),
});
export type ConsentView = z.infer<typeof consentViewSchema>;

export const consentListSchema = z.array(consentViewSchema);

/** `GET /me/interests` — do mais forte ao mais fraco. */
export const interestListSchema = z.array(interestSchema);

/** `PATCH /me` — só o nome muda (e-mail não tem rota de troca). */
export const updateAccountRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
});
export type UpdateAccountRequest = z.infer<typeof updateAccountRequestSchema>;

export const updateAccountResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type UpdateAccountResponse = z.infer<typeof updateAccountResponseSchema>;

/**
 * `PATCH /me/profile` — todos os campos opcionais; só vai o que mudou.
 * `targetDate` é `YYYY-MM-DD` ou `null` para limpar.
 */
export const updateProfileRequestSchema = z.object({
  goals: z.array(learningGoalSchema).max(7).optional(),
  goalNote: z.string().trim().max(500).nullable().optional(),
  availabilityMinutes: availabilityMinutesSchema.partial().optional(),
  preferredStudyTime: preferredStudyTimeSchema.optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  selfReportedLevel: selfReportedLevelSchema.optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  nativeLanguage: z.string().trim().min(2).max(16).optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const replaceInterestsRequestSchema = z.object({
  /** Mesmo teto do back-end (`MAX_INTERESTS_PER_USER`). */
  interests: z.array(interestSchema).max(20),
});

/**
 * `GET /me/export` e `GET /me/export/:id`. O link vem assinado e só quando
 * o arquivo está pronto e ainda não venceu.
 */
export const dataExportViewSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  downloadUrl: z.string().nullable(),
});
export type DataExportView = z.infer<typeof dataExportViewSchema>;

/** `GET /me/export`: `null` (corpo vazio) quando o aluno nunca pediu. */
export const latestDataExportSchema = dataExportViewSchema.nullable();

export const requestDataExportResponseSchema = z.object({ id: z.string() });

/** `DELETE /me` — sai do ar agora, anonimiza depois da carência. */
export const deleteAccountResponseSchema = z.object({
  deletedAt: z.string(),
  anonymizeAt: z.string(),
  daysRemaining: z.number(),
});
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;
