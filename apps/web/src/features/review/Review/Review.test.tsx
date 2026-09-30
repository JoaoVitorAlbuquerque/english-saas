import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
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

beforeEach(() => {
  resetTodayMockState();
});

describe('Revisão', () => {
  it('faz a sessão inteira: item com correção, flashcard auto-avaliado e o resumo', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/revisao');

    expect(
      await screen.findByText('Quanto tempo você tem agora?'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '10 min' }));

    // --- card de SKILL: questão real, com feedback antes de continuar ---
    expect(
      await screen.findByText('Complete: I ___ Lucas.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '1. am' }));
    expect(await screen.findByText('Boa!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    // --- flashcard: vira e se auto-avalia ---
    expect(await screen.findByText('friendly')).toBeInTheDocument();
    expect(screen.queryByText('amigável')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Virar' }));
    expect(await screen.findByText('amigável')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acertei' }));

    // --- resumo ---
    expect(await screen.findByText('Sessão concluída')).toBeInTheDocument();
    expect(screen.getByText('2 revisados')).toBeInTheDocument();
    expect(screen.getByText('Quando eles voltam')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Voltar para Hoje' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Revisão' }),
    ).toBeInTheDocument();
  });

  it('sem cards vencidos, mostra o estado vazio', async () => {
    mockAuthenticatedStudent();
    server.use(
      http.get(`${API_URL}/reviews/session`, () => HttpResponse.json([])),
    );
    renderAppAt('/revisao');

    await userEvent.click(await screen.findByRole('button', { name: '5 min' }));

    expect(
      await screen.findByText('Nada pra revisar agora'),
    ).toBeInTheDocument();
  });

  it('sair no meio pede confirmação', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/revisao');

    await userEvent.click(
      await screen.findByRole('button', { name: '10 min' }),
    );
    await screen.findByText('Complete: I ___ Lucas.');

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('Sair da revisão?')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Continuar revisando' }),
    );
    expect(screen.queryByText('Sair da revisão?')).not.toBeInTheDocument();
    expect(screen.getByText('Complete: I ___ Lucas.')).toBeInTheDocument();
  });
});
