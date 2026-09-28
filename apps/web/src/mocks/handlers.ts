import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3333';

export const sessionFixture = {
  user: {
    id: 'user-1',
    name: 'Aluno Teste',
    email: 'aluno@exemplo.com',
    role: 'STUDENT',
    emailVerifiedAt: null,
  },
  accessToken: 'fake-access-token',
  csrfToken: 'fake-csrf-token',
};

export const freshProfileFixture = {
  userId: 'user-1',
  goals: [],
  goalNote: null,
  availabilityMinutes: {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  },
  preferredStudyTime: 'ANY',
  targetDate: null,
  selfReportedLevel: 'NONE',
  timezone: 'America/Sao_Paulo',
  nativeLanguage: 'pt-BR',
  onboardingCompletedAt: null,
};

export const completedProfileFixture = {
  ...freshProfileFixture,
  goals: ['TRAVEL'],
  availabilityMinutes: {
    mon: 20,
    tue: 20,
    wed: 20,
    thu: 20,
    fri: 20,
    sat: 0,
    sun: 0,
  },
  selfReportedLevel: 'NONE',
  onboardingCompletedAt: new Date().toISOString(),
};

export const handlers = [
  http.post(`${API_URL}/auth/signin`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.password !== 'senha-correta') {
      return HttpResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'E-mail ou senha incorretos.',
          },
        },
        { status: 401 },
      );
    }

    return HttpResponse.json(sessionFixture);
  }),

  http.post(`${API_URL}/auth/signup`, () => HttpResponse.json(sessionFixture)),

  http.post(`${API_URL}/auth/refresh`, () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sessão expirada.' } },
      { status: 401 },
    ),
  ),

  http.post(
    `${API_URL}/auth/logout`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  http.get(`${API_URL}/me/profile`, () =>
    HttpResponse.json(freshProfileFixture),
  ),

  http.put(`${API_URL}/me/consents`, async ({ request }) => {
    const body = (await request.json()) as { type: string; granted: boolean };

    return HttpResponse.json([
      {
        type: body.type,
        version: '2026-01-01',
        granted: body.granted,
        grantedAt: body.granted ? new Date().toISOString() : null,
        revokedAt: body.granted ? null : new Date().toISOString(),
        upToDate: true,
      },
    ]);
  }),

  http.post(`${API_URL}/me/onboarding`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json({
      ...freshProfileFixture,
      ...body,
      onboardingCompletedAt: new Date().toISOString(),
      interests: body.interests ?? [],
    });
  }),
];
