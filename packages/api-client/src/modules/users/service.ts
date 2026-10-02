import type { Interest } from '@english-saas/shared';

import { apiFetch } from '../../http/fetch-client';
import {
  completeOnboardingRequestSchema,
  completeOnboardingResponseSchema,
  consentListSchema,
  dataExportViewSchema,
  deleteAccountResponseSchema,
  interestListSchema,
  latestDataExportSchema,
  replaceInterestsRequestSchema,
  requestDataExportResponseSchema,
  studentProfileSchema,
  updateAccountRequestSchema,
  updateAccountResponseSchema,
  updateConsentRequestSchema,
  updateProfileRequestSchema,
  type CompleteOnboardingRequest,
  type CompleteOnboardingResponse,
  type ConsentView,
  type DataExportView,
  type DeleteAccountResponse,
  type StudentProfile,
  type UpdateAccountRequest,
  type UpdateAccountResponse,
  type UpdateConsentRequest,
  type UpdateProfileRequest,
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

export async function updateAccount(
  input: UpdateAccountRequest,
): Promise<UpdateAccountResponse> {
  const body = updateAccountRequestSchema.parse(input);

  return apiFetch('/me', {
    method: 'PATCH',
    body,
    schema: updateAccountResponseSchema,
  });
}

export async function updateProfile(
  input: UpdateProfileRequest,
): Promise<StudentProfile> {
  const body = updateProfileRequestSchema.parse(input);

  return apiFetch('/me/profile', {
    method: 'PATCH',
    body,
    schema: studentProfileSchema,
  });
}

export async function replaceInterests(
  interests: Interest[],
): Promise<Interest[]> {
  const body = replaceInterestsRequestSchema.parse({ interests });

  return apiFetch('/me/interests', {
    method: 'PUT',
    body,
    schema: interestListSchema,
  });
}

/** O export mais recente, ou `null` se o aluno nunca pediu. */
export async function getLatestExport(): Promise<DataExportView | null> {
  return apiFetch('/me/export', { schema: latestDataExportSchema });
}

export async function getExport(id: string): Promise<DataExportView> {
  return apiFetch(`/me/export/${id}`, { schema: dataExportViewSchema });
}

/** 202: o arquivo é montado numa fila; acompanhe por `getExport`. */
export async function requestExport(): Promise<{ id: string }> {
  return apiFetch('/me/export', {
    method: 'POST',
    schema: requestDataExportResponseSchema,
  });
}

export async function deleteAccount(): Promise<DeleteAccountResponse> {
  return apiFetch('/me', {
    method: 'DELETE',
    schema: deleteAccountResponseSchema,
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
