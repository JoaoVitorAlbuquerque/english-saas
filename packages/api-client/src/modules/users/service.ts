import type { Interest } from '@english-saas/shared';

import { apiFetch } from '../../http/fetch-client';
import {
  completeOnboardingRequestSchema,
  completeOnboardingResponseSchema,
  consentListSchema,
  interestListSchema,
  studentProfileSchema,
  updateConsentRequestSchema,
  type CompleteOnboardingRequest,
  type CompleteOnboardingResponse,
  type ConsentView,
  type StudentProfile,
  type UpdateConsentRequest,
} from './schemas';

export async function getProfile(): Promise<StudentProfile> {
  return apiFetch('/me/profile', { schema: studentProfileSchema });
}

export async function getInterests(): Promise<Interest[]> {
  return apiFetch('/me/interests', { schema: interestListSchema });
}

export async function completeOnboarding(
  input: CompleteOnboardingRequest,
): Promise<CompleteOnboardingResponse> {
  const body = completeOnboardingRequestSchema.parse(input);

  return apiFetch('/me/onboarding', {
    method: 'POST',
    body,
    schema: completeOnboardingResponseSchema,
  });
}

export async function listConsents(): Promise<ConsentView[]> {
  return apiFetch('/me/consents', { schema: consentListSchema });
}

export async function updateConsent(
  input: UpdateConsentRequest,
): Promise<ConsentView[]> {
  const body = updateConsentRequestSchema.parse(input);

  return apiFetch('/me/consents', {
    method: 'PUT',
    body,
    schema: consentListSchema,
  });
}
