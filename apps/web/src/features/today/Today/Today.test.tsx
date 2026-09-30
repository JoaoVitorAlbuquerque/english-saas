import { HttpResponse, http } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from '../../../App';
import {
  completedProfileFixture,
  resetTodayMockState,
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

function blockCard(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: title });
  const card = heading.closest('div.rounded-2xl');
  if (card === null) {
    throw new Error(`Bloco "${title}" não está dentro de um Card.`);
  }
  return card as HTMLElement;
}

beforeEach(() => {
  resetTodayMockState();
});

describe('Hoje', () => {
  it('mostra os três tipos de bloco da agenda, com minutos e motivo', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/hoje');

    expect(
      await screen.findByRole('heading', { name: 'Revisão' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Nice to meet you' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Prática' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('3 cards de revisão vencidos.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Começar').length).toBeGreaterThan(0);
  });

  it('pular um bloco com motivo marca como pulado', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/hoje');

    await screen.findByRole('heading', { name: 'Revisão' });

    await userEvent.click(
      within(blockCard('Revisão')).getByRole('button', { name: 'Pular' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sem tempo agora' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pular bloco' }));

    await screen.findByText('Pulado');
    expect(
      within(blockCard('Revisão')).getByText('Pulado'),
    ).toBeInTheDocument();
  });

  it('concluir a prática inline marca o bloco como feito', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/hoje');

    await screen.findByRole('heading', { name: 'Prática' });

    await userEvent.click(
      within(blockCard('Prática')).getByRole('button', { name: 'Começar' }),
    );

    expect(
      await screen.findByText('Complete: She ___ from Brazil.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '1. is' }));

    await userEvent.click(
      await screen.findByRole('button', { name: 'Continuar' }),
    );

    await screen.findByText('Feito');
    expect(within(blockCard('Prática')).getByText('Feito')).toBeInTheDocument();
  });

  it('"Começar" no bloco de revisão leva pra tela de Revisão', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/hoje');

    await screen.findByRole('heading', { name: 'Revisão' });

    await userEvent.click(
      within(blockCard('Revisão')).getByRole('button', { name: 'Começar' }),
    );

    expect(
      await screen.findByText('Quanto tempo você tem agora?'),
    ).toBeInTheDocument();
  });

  it('"Começar" na lição leva pro player, com o slug certo', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/hoje');

    await screen.findByRole('heading', { name: 'Nice to meet you' });

    await userEvent.click(
      within(blockCard('Nice to meet you')).getByRole('button', {
        name: 'Começar',
      }),
    );

    expect(
      await screen.findByText('Hi! Are you new here?'),
    ).toBeInTheDocument();
  });
});
