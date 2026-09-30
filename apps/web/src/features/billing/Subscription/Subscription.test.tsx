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

const activeOverview = {
  tier: 'PLUS',
  message:
    'Seu plano Plus renova em 29/10/2026. Dá para cancelar quando quiser.',
  subscription: {
    id: 'sub-active-1',
    tier: 'PLUS',
    billingPeriod: 'MONTHLY',
    status: 'ACTIVE',
    priceCents: 6_990,
    priceLabel: 'R$ 69,90 por mês',
    paymentMethod: 'PIX',
    checkoutUrl: null,
    currentPeriodEnd: '2026-10-29T00:00:00.000Z',
    accessUntil: '2026-10-29T00:00:00.000Z',
    canceledAt: null,
  },
};

function mockActiveSubscription() {
  server.use(
    http.get(`${API_URL}/me/subscription`, () =>
      HttpResponse.json(activeOverview),
    ),
  );
}

describe('Minha assinatura', () => {
  it('mostra o plano atual e o histórico de créditos', async () => {
    mockAuthenticatedStudent();
    mockActiveSubscription();
    renderAppAt('/minha-assinatura');

    expect(await screen.findByText('PLUS')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seu plano Plus renova em 29/10/2026. Dá para cancelar quando quiser.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Crédito do ciclo')).toBeInTheDocument();
  });

  it('cancelar pede confirmação e mostra até quando o acesso continua', async () => {
    mockAuthenticatedStudent();
    mockActiveSubscription();
    server.use(
      http.post(`${API_URL}/billing/cancel`, () =>
        HttpResponse.json({
          ...activeOverview,
          message:
            'Assinatura cancelada. Você continua com o plano Plus até 29/10/2026, e nada mais será cobrado.',
          subscription: {
            ...activeOverview.subscription,
            status: 'CANCELED',
            canceledAt: '2026-09-29T00:00:00.000Z',
          },
        }),
      ),
    );
    renderAppAt('/minha-assinatura');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancelar assinatura' }),
    );

    expect(await screen.findByText('Cancelar assinatura?')).toBeInTheDocument();
    expect(screen.getByText(/29\/10\/2026/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancelar mesmo assim' }),
    );

    expect(
      await screen.findByText(
        'Assinatura cancelada. Você continua com o plano Plus até 29/10/2026, e nada mais será cobrado.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancelar assinatura' }),
    ).not.toBeInTheDocument();
  });
});
