import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  completeOnboarding,
  deleteAccount,
  getLatestExport,
  getProfile,
  replaceInterests,
  requestExport,
  updateConsent,
  updateProfile,
} from './service';

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

describe('updateProfile', () => {
  it('manda só o que mudou, em PATCH, e recebe o perfil de volta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        userId: 'user-1',
        goals: ['TRAVEL'],
        goalNote: null,
        availabilityMinutes: { ...fullAvailability, sat: 30 },
        preferredStudyTime: 'ANY',
        targetDate: '2027-03-01',
        selfReportedLevel: 'NONE',
        timezone: 'America/Sao_Paulo',
        nativeLanguage: 'pt-BR',
        onboardingCompletedAt: new Date().toISOString(),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    // A disponibilidade é trocada inteira: o back-end normaliza e substitui a
    // semana toda, então quem chama manda os sete dias.
    const week = { ...fullAvailability, sat: 30 };
    const profile = await updateProfile({
      availabilityMinutes: week,
      targetDate: '2027-03-01',
    });

    expect(profile.availabilityMinutes.sat).toBe(30);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/profile',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          availabilityMinutes: week,
          targetDate: '2027-03-01',
        }),
      }),
    );
  });

  it('recusa data fora do formato antes de chamar a API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateProfile({ targetDate: '01/03/2027' })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('replaceInterests', () => {
  it('troca a lista inteira com PUT', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse([{ topic: 'history', weight: 50 }]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await replaceInterests([{ topic: 'history', weight: 50 }]);

    expect(result).toEqual([{ topic: 'history', weight: 50 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/interests',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('export de dados', () => {
  it('sem nenhum export, o corpo vazio do back-end vira null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 200 })),
    );

    await expect(getLatestExport()).resolves.toBeNull();
  });

  it('pronto, traz o link assinado e o tamanho', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'exp-1',
          status: 'READY',
          createdAt: '2026-10-02T10:00:00.000Z',
          expiresAt: '2026-10-03T10:00:00.000Z',
          sizeBytes: 2048,
          downloadUrl: 'https://files.local/meus-dados.json?sig=abc',
        }),
      ),
    );

    const view = await getLatestExport();

    expect(view?.status).toBe('READY');
    expect(view?.downloadUrl).toContain('meus-dados');
  });

  it('o pedido é um POST que devolve só o id (202)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 'exp-2' }, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestExport()).resolves.toEqual({ id: 'exp-2' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/export',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('deleteAccount', () => {
  it('devolve a data da anonimização e os dias de carência', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        deletedAt: '2026-10-02T10:00:00.000Z',
        anonymizeAt: '2026-11-01T10:00:00.000Z',
        daysRemaining: 30,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await deleteAccount();

    expect(result.daysRemaining).toBe(30);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me',
      expect.objectContaining({ method: 'DELETE' }),
    );
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
