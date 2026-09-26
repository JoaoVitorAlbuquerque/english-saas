import { createQueryClient } from '@english-saas/api-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Login } from './index';

function renderLogin() {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/hoje" element={<p>Página Hoje</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Login', () => {
  it('navega para /hoje após um login bem-sucedido', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText('E-mail'), 'aluno@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-correta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Página Hoje')).toBeInTheDocument();
  });

  it('mostra mensagem de erro pt-BR em credenciais inválidas', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText('E-mail'), 'aluno@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText(
        'Não foi possível entrar. Confira seus dados e tente de novo.',
      ),
    ).toBeInTheDocument();
  });
});
