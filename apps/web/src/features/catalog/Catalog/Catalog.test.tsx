import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import {
  completedProfileFixture,
  sessionFixture,
} from '../../../mocks/handlers';
import { server } from '../../../mocks/server';

const API_URL = 'http://localhost:3333';

function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

function mockAuthenticatedStudent() {
  server.use(
    http.post(`${API_URL}/auth/refresh`, () =>
      HttpResponse.json(sessionFixture),
    ),
    http.get(`${API_URL}/me/profile`, () =>
      HttpResponse.json(completedProfileFixture),
    ),
  );
}

describe('Catálogo', () => {
  it('lista as unidades agrupadas por nível', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/catalogo');

    expect(
      await screen.findByRole('heading', { name: 'Primeiros passos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Fazendo compras' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'A1 · Iniciante' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'B1 · Intermediário' }),
    ).toBeInTheDocument();
  });

  it('busca por título ou sinopse filtra a lista', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/catalogo');

    await screen.findByRole('heading', { name: 'Primeiros passos' });

    await userEvent.type(
      screen.getByPlaceholderText('Buscar por título ou assunto'),
      'negociar',
    );

    expect(
      await screen.findByRole('heading', { name: 'Fazendo compras' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Primeiros passos' }),
    ).not.toBeInTheDocument();
  });

  it('filtro por nível mostra só as unidades daquele nível', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/catalogo');

    await screen.findByRole('heading', { name: 'Primeiros passos' });

    await userEvent.click(
      screen.getByRole('button', { name: 'B1 · Intermediário' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Fazendo compras' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Primeiros passos' }),
    ).not.toBeInTheDocument();
  });

  it('clicar numa unidade abre a página dela', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/catalogo');

    await userEvent.click(
      await screen.findByRole('heading', { name: 'Primeiros passos' }),
    );

    expect(await screen.findByText('Segredos do prédio')).toBeInTheDocument();
  });
});
