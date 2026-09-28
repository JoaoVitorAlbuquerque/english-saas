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
          <Route path="/" element={<p>Painel</p>} />
          <Route path="/403" element={<p>Sem acesso</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Login (admin)', () => {
  it('navega para o painel quando editor faz login', async () => {
    renderLogin();

    await userEvent.type(
      screen.getByLabelText('E-mail'),
      'editora@exemplo.com',
    );
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-correta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Painel')).toBeInTheDocument();
  });

  it('desloga e manda para /403 quando a conta não é editor nem admin', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText('E-mail'), 'aluno@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-aluno');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Sem acesso')).toBeInTheDocument();
  });
});
