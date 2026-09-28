import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';

import { completedProfileFixture, handlers, sessionFixture } from './handlers';

const API_URL = 'http://localhost:3333';

/** O teste liga com `page.addInitScript` — ver `e2e/lesson.spec.ts`. */
export const E2E_AUTHENTICATED_KEY = '__e2e_authenticated__';

function isAuthenticatedScenario(): boolean {
  try {
    return window.localStorage.getItem(E2E_AUTHENTICATED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Cenário "aluno logado e com onboarding completo", opcional: o e2e da lição
 * testa o player, não o login, mas o smoke do login precisa do padrão (sem
 * sessão). Resolver que devolve `undefined` cai no próximo handler — sem a
 * marca, valem os padrão de `handlers.ts`.
 */
const e2eAuthHandlers = [
  http.post(`${API_URL}/auth/refresh`, () =>
    isAuthenticatedScenario() ? HttpResponse.json(sessionFixture) : undefined,
  ),
  http.get(`${API_URL}/me/profile`, () =>
    isAuthenticatedScenario()
      ? HttpResponse.json(completedProfileFixture)
      : undefined,
  ),
];

/**
 * Worker de mock no navegador — usado só pelo Playwright (`e2e/`), atrás de
 * `VITE_E2E_MOCKS`. Os testes do Vitest usam `mocks/server.ts` (Node); o
 * Playwright roda contra o build de verdade, então precisa do worker real do
 * `msw/browser`, com o mesmo `handlers.ts`.
 */
export const worker = setupWorker(...e2eAuthHandlers, ...handlers);
