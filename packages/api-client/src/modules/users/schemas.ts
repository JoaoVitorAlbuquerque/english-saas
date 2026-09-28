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
