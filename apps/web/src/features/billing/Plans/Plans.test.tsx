import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from '../../../App';
import {
  completedProfileFixture,
  resetBillingMockState,
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

beforeEach(() => {
  resetBillingMockState();
});

describe('Planos', () => {
  it('mostra os três planos, com o Gratuito marcado como atual', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/planos');

    expect(
      await screen.findByRole('heading', { name: 'Gratuito' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Base' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plus' })).toBeInTheDocument();
    expect(screen.getByText('Seu plano atual')).toBeInTheDocument();
    expect(screen.getByText('R$ 29,90 por mês')).toBeInTheDocument();
  });

  it('trocar para anual muda o preço exibido', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/planos');

    await screen.findByText('R$ 29,90 por mês');
    await userEvent.click(screen.getByRole('tab', { name: 'Anual' }));

    expect(
      await screen.findByText(
        'R$ 299,00 por ano (equivale a R$ 24,92 por mês)',
      ),
    ).toBeInTheDocument();
  });

  it('assinar o Base leva pro checkout com o plano escolhido', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/planos');

    await screen.findByText('R$ 29,90 por mês');
    const [subscribeBase] = screen.getAllByRole('button', { name: 'Assinar' });
    if (subscribeBase === undefined) {
      throw new Error('Botão de assinar não encontrado.');
    }
    await userEvent.click(subscribeBase);

    expect(
      await screen.findByRole('heading', { name: 'Finalizar assinatura' }),
    ).toBeInTheDocument();
  });
});
