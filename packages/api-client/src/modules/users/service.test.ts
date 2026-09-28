import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { completeOnboarding, getProfile, updateConsent } from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const fullAvailability = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('getProfile', () => {
  it('mostra onboardingCompletedAt nulo para quem ainda não fez onboarding', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          userId: 'user-1',
          goals: [],
          goalNote: null,
          availabilityMinutes: fullAvailability,
          preferredStudyTime: 'ANY',
          targetDate: null,
          selfReportedLevel: 'NONE',
          timezone: 'America/Sao_Paulo',
          nativeLanguage: 'pt-BR',
          onboardingCompletedAt: null,
        }),
      ),
    );

    const profile = await getProfile();

    expect(profile.onboardingCompletedAt).toBeNull();
  });
});

describe('completeOnboarding', () => {
  it('envia o payload acumulado e recebe o perfil completo de volta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        userId: 'user-1',
        goals: ['TRAVEL'],
        goalNote: null,
        availabilityMinutes: { ...fullAvailability, mon: 20 },
        preferredStudyTime: 'MORNING',
        targetDate: null,
        selfReportedLevel: 'BASIC',
        timezone: 'America/Sao_Paulo',
        nativeLanguage: 'pt-BR',
        onboardingCompletedAt: new Date().toISOString(),
        interests: [{ topic: 'history', weight: 50 }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await completeOnboarding({
      goals: ['TRAVEL'],
      availabilityMinutes: { mon: 20 },
      preferredStudyTime: 'MORNING',
      selfReportedLevel: 'BASIC',
      interests: [{ topic: 'history', weight: 50 }],
    });

    expect(result.onboardingCompletedAt).not.toBeNull();
    expect(result.interests).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/onboarding',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejeita antes de chamar a API quando não há objetivo escolhido', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      completeOnboarding({
        goals: [],
        availabilityMinutes: {},
        selfReportedLevel: 'NONE',
        interests: [],
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('updateConsent', () => {
  it('atualiza um consentimento e recebe a lista inteira de volta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            type: 'DATA_PERSONALIZATION',
            version: '2026-01-01',
            granted: true,
            grantedAt: new Date().toISOString(),
            revokedAt: null,
            upToDate: true,
          },
        ]),
      ),
    );

    const consents = await updateConsent({
      type: 'DATA_PERSONALIZATION',
      granted: true,
    });

    expect(consents[0]?.granted).toBe(true);
  });
});
