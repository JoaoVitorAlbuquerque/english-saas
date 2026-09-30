import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../App';
import {
  completedProfileFixture,
  resetCheckpointMockState,
  resetLessonMockState,
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
  resetCheckpointMockState();
  resetLessonMockState();
});

describe('Unidade', () => {
  it('lição bloqueada abre o paywall em vez de navegar', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/unidades/primeiros-passos');

    await userEvent.click(await screen.findByText('Segredos do prédio'));

    expect(await screen.findByText('Isso é do plano Base')).toBeInTheDocument();
    // Continua na página da unidade — não navegou pro player.
    expect(screen.getByText('Segredos do prédio')).toBeInTheDocument();
  });

  it('lição liberada abre o player de verdade', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/unidades/primeiros-passos');

    await userEvent.click(await screen.findByText('Nice to meet you'));

    expect(
      await screen.findByText('Hi! Are you new here?'),
    ).toBeInTheDocument();
  });

  it('faz o checkpoint da unidade até o resultado', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/unidades/primeiros-passos');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Fazer checkpoint' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Começar' }),
    );

    expect(
      await screen.findByText('Complete: She ___ my neighbor.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '1. is' }));

    expect(
      await screen.findByText('Complete: They ___ from Brazil.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '1. are' }));

    expect(
      await screen.findByText('Resultado do checkpoint'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tudo certo com esta unidade. Pode seguir.'),
    ).toBeInTheDocument();
  });

  it('baixa a apostila liberada numa nova aba', async () => {
    mockAuthenticatedStudent();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderAppAt('/unidades/primeiros-passos');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Baixar' }),
    );

    await vi.waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/apostila.pdf',
        '_blank',
        'noopener,noreferrer',
      );
    });

    openSpy.mockRestore();
  });
});
