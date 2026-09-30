import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import {
  completedProfileFixture,
  placementFirstItemFixture,
  placementInProgressFixture,
  placementResultFixture,
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

describe('nivelamento', () => {
  it('vai da intro até o resultado, e "Ver meu plano" leva pra Hoje', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/nivelamento');

    expect(
      await screen.findByText('Vamos descobrir seu nível'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Começar' }));

    expect(
      await screen.findByText('Complete: I ___ Maya.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '1. am' }));

    expect(await screen.findByText('Intermediário')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Conecta frases para contar uma história ou explicar um plano, mesmo com alguns erros que não atrapalham o entendimento.',
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Ver meu plano' }),
    );

    expect(await screen.findByText('Nice to meet you')).toBeInTheDocument();
  });

  it('retoma direto na questão quando já existe um teste em andamento', async () => {
    mockAuthenticatedStudent();
    server.use(
      http.get(`${API_URL}/placement/latest`, () =>
        HttpResponse.json(placementInProgressFixture),
      ),
    );

    renderAppAt('/nivelamento');

    expect(
      await screen.findByText('Complete: I ___ Maya.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Vamos descobrir seu nível'),
    ).not.toBeInTheDocument();
  });

  it('"Não sei" envia todas as alternativas, sem exigir escolha', async () => {
    mockAuthenticatedStudent();
    let sentBody: unknown;
    server.use(
      http.post(`${API_URL}/placement/:id/answer`, async ({ request }) => {
        sentBody = await request.json();

        return HttpResponse.json(placementResultFixture);
      }),
    );

    renderAppAt('/nivelamento');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Começar' }),
    );
    await screen.findByText('Complete: I ___ Maya.');

    await userEvent.click(screen.getByRole('button', { name: 'Não sei' }));

    expect(await screen.findByText('Intermediário')).toBeInTheDocument();
    expect(sentBody).toMatchObject({
      itemId: placementFirstItemFixture.id,
      response: { optionIds: ['am', 'is', 'are'] },
    });
  });

  it('bloqueia "Refazer" antes dos 60 dias, com a data de quando dá pra refazer', async () => {
    mockAuthenticatedStudent();
    const nextAvailableAt = new Date(
      Date.now() + 40 * 86_400_000,
    ).toISOString();

    server.use(
      http.get(`${API_URL}/placement/latest`, () =>
        HttpResponse.json({
          ...placementResultFixture,
          result: { ...placementResultFixture.result, nextAvailableAt },
        }),
      ),
    );

    renderAppAt('/nivelamento');

    const retakeButton = await screen.findByRole('button', {
      name: 'Refazer o nivelamento',
    });
    expect(retakeButton).toBeDisabled();
    expect(
      screen.getByText(
        `Você poderá refazer a partir de ${new Date(nextAvailableAt).toLocaleDateString('pt-BR')}`,
      ),
    ).toBeInTheDocument();
  });
});
