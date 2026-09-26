import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3333';

export const sessionFixture = {
  user: {
    id: 'user-1',
    name: 'Aluno Teste',
    email: 'aluno@exemplo.com',
    role: 'STUDENT',
  },
  accessToken: 'fake-access-token',
  csrfToken: 'fake-csrf-token',
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
];
