import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';

import {
  adminSessionFixture,
  editorSessionFixture,
  handlers,
} from './handlers';
import { seedReadyLessonDraft } from './studio-mock';

const API_URL = 'http://localhost:3333';

/** O teste liga com `page.addInitScript` — ver `e2e/curriculum.spec.ts`. */
export const E2E_AUTHENTICATED_KEY = '__e2e_authenticated__';
/** `ADMIN` entra como administrador; sem a chave, entra como editor. */
export const E2E_ROLE_KEY = '__e2e_role__';

function isAuthenticatedScenario(): boolean {
  try {
    return window.localStorage.getItem(E2E_AUTHENTICATED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Cenário "editor logado": o e2e do conteúdo testa o painel, não o login,
 * mas o smoke do login precisa do padrão (sem sessão). Resolver que devolve
 * `undefined` cai no próximo handler.
 */
function scenarioSession() {
  try {
    return window.localStorage.getItem(E2E_ROLE_KEY) === 'ADMIN'
      ? adminSessionFixture
      : editorSessionFixture;
  } catch {
    return editorSessionFixture;
  }
}

const e2eAuthHandlers = [
  http.post(`${API_URL}/auth/refresh`, () =>
    isAuthenticatedScenario()
      ? HttpResponse.json(scenarioSession())
      : undefined,
  ),
];

/**
 * Worker de mock no navegador — usado só pelo Playwright (`e2e/`), atrás de
 * `VITE_E2E_MOCKS`. Os testes do Vitest usam `mocks/server.ts` (Node).
 */
export const worker = setupWorker(...e2eAuthHandlers, ...handlers);

/**
 * Os testes de ponta a ponta do estúdio precisam de um rascunho de lição já
 * pronto (com a revisão e os bloqueadores) e o estado do mock vive nesta página:
 * eles pedem por aqui, depois de abrir o painel. Só existe no build de e2e.
 */
declare global {
  interface Window {
    __studioMock?: { seedReadyLessonDraft: typeof seedReadyLessonDraft };
  }
}

window.__studioMock = { seedReadyLessonDraft };
