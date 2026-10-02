import { dismissToast, getToasts } from '@english-saas/ui';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { App } from '../../App';
import { sessionFixture } from '../../mocks/handlers';
import {
  profileHandlers,
  resetProfileMockState,
  statefulProfileHandler,
} from '../../mocks/profile-handlers';
import { server } from '../../mocks/server';
import { useAuthStore } from '../../stores/auth-store';
import { useSessionNoticeStore } from '../../stores/session-notice-store';

export const API_URL = 'http://localhost:3333';

export function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

/**
 * Aluno logado, com o perfil e as configurações em estado de memória
 * (`profile-handlers`). A sessão é um singleton: sem zerar, um teste que sai
 * (logout, exclusão) deixaria o próximo começando deslogado.
 */
export function mockStudent() {
  resetProfileMockState();
  useAuthStore.setState({ status: 'checking', user: null });
  useSessionNoticeStore.getState().clear();
  // O store de avisos é global: sem limpar, um "Salvo" vaza para o teste seguinte.
  getToasts().forEach((item) => dismissToast(item.id));

  server.use(
    http.post(`${API_URL}/auth/refresh`, () =>
      HttpResponse.json(sessionFixture),
    ),
    statefulProfileHandler,
    ...profileHandlers,
  );
}
