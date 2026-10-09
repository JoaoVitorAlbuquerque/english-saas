/* Helper de teste: exporta funções e um componente auxiliar de propósito. */
/* eslint-disable react-refresh/only-export-components */
import { createQueryClient } from '@english-saas/api-client';
import { Toaster, dismissToast, getToasts } from '@english-saas/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { AppRoutes } from '../../app/router';
import {
  adminSessionFixture,
  editorSessionFixture,
} from '../../mocks/handlers';
import { useAuthStore } from '../../stores/auth-store';

export const API_URL = 'http://localhost:3333';

function LocationProbe() {
  const location = useLocation();

  return <pre data-testid="location">{location.pathname}</pre>;
}

/**
 * O painel inteiro numa rota, com o editor já logado (ou o administrador,
 * nas telas de gestão). O estado da sessão e
 * dos avisos é global: sem zerar, um teste vazaria para o seguinte.
 */
export function renderAdminAt(
  path: string,
  options: { role?: 'EDITOR' | 'ADMIN' } = {},
) {
  const session =
    options.role === 'ADMIN' ? adminSessionFixture : editorSessionFixture;

  useAuthStore.setState({
    status: 'authenticated',
    user: session.user as never,
  });
  getToasts().forEach((item) => dismissToast(item.id));

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}
