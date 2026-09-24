import {
  availabilityMinutesSchema,
  consentTypeSchema,
  interestSchema,
  learningGoalSchema,
  preferredStudyTimeSchema,
  selfReportedLevelSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { MAX_INTERESTS_PER_USER } from '../domain/interests';

export class UpdateMeDto extends createZodDto(
  z.object({ name: z.string().trim().min(2).max(120).optional() }),
) {}

const profileFields = {
  goals: z.array(learningGoalSchema).max(7).optional(),
  goalNote: z.string().trim().max(500).nullable().optional(),
  availabilityMinutes: availabilityMinutesSchema.partial().optional(),
  preferredStudyTime: preferredStudyTimeSchema.optional(),
  /** ISO 8601 (`2026-12-31`) ou null para limpar. */
  targetDate: z.iso.date().nullable().optional(),
  selfReportedLevel: selfReportedLevelSchema.optional(),
  /** IANA, ex.: `America/Sao_Paulo`. */
  timezone: z.string().trim().min(3).max(64).optional(),
  nativeLanguage: z.string().trim().min(2).max(16).optional(),
};

export class UpdateProfileDto extends createZodDto(z.object(profileFields)) {}

export class ReplaceInterestsDto extends createZodDto(
  z.object({
    interests: z.array(interestSchema).max(MAX_INTERESTS_PER_USER),
  }),
) {}

/** Salva tudo de uma vez ao fim do onboarding. */
export class CompleteOnboardingDto extends createZodDto(
  z.object({
    ...profileFields,
    goals: z.array(learningGoalSchema).min(1).max(7),
    availabilityMinutes: availabilityMinutesSchema.partial(),
    selfReportedLevel: selfReportedLevelSchema,
    interests: z.array(interestSchema).max(MAX_INTERESTS_PER_USER).default([]),
  }),
) {}

export class UpdateConsentDto extends createZodDto(
  z.object({
    type: consentTypeSchema,
    granted: z.boolean(),
  }),
) {}
