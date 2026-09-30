import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('Checkout', () => {
  it('sem plano escolhido, pede pra voltar aos planos', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/checkout');

    expect(
      await screen.findByText('Nenhum plano escolhido'),
    ).toBeInTheDocument();
  });

  it('checkout de Pix até a assinatura ficar ativa', async () => {
    mockAuthenticatedStudent();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    renderAppAt('/planos');

    const [subscribeBase] = await screen.findAllByRole('button', {
      name: 'Assinar',
    });
    if (subscribeBase === undefined) {
      throw new Error('Botão de assinar não encontrado.');
    }
    await userEvent.click(subscribeBase);

    await screen.findByRole('heading', { name: 'Finalizar assinatura' });
    // Pix já vem selecionado por padrão.
    await userEvent.type(screen.getByLabelText('CPF ou CNPJ'), '12345678909');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByText('Aguardando pagamento', {}, { timeout: 5_000 }),
    ).toBeInTheDocument();

    // O mock só ativa depois de um ciclo real do polling.
    expect(
      await screen.findByText('Pagamento confirmado', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Ver minha assinatura' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Minha assinatura' }),
    ).toBeInTheDocument();
  }, 15_000);
});
