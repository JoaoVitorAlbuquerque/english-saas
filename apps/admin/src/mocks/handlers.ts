import { http, HttpResponse } from 'msw';

import { curriculumHandlers } from './curriculum-mock';

const API_URL = 'http://localhost:3333';

export const editorSessionFixture = {
  user: {
    id: 'user-1',
    name: 'Editora Teste',
    email: 'editora@exemplo.com',
    role: 'EDITOR',
    emailVerifiedAt: new Date().toISOString(),
  },
  accessToken: 'fake-access-token',
  csrfToken: 'fake-csrf-token',
};

export const studentSessionFixture = {
  user: {
    id: 'user-2',
    name: 'Aluno Teste',
    email: 'aluno@exemplo.com',
    role: 'STUDENT',
    emailVerifiedAt: null,
  },
  accessToken: 'fake-student-access-token',
  csrfToken: 'fake-csrf-token',
};

export const handlers = [
  ...curriculumHandlers,

  http.post(`${API_URL}/auth/signin`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.password === 'senha-correta') {
      return HttpResponse.json(editorSessionFixture);
    }

    if (body.password === 'senha-aluno') {
      return HttpResponse.json(studentSessionFixture);
    }

    return HttpResponse.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha incorretos.',
        },
      },
      { status: 401 },
    );
  }),

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
