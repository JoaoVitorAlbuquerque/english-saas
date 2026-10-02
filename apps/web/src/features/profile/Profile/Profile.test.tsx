import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { profileCalls } from '../../../mocks/profile-handlers';
import { server } from '../../../mocks/server';
import { API_URL, mockStudent, renderAppAt } from '../test-helpers';

async function findLoginScreen() {
  return screen.findByRole('heading', { name: 'Entre na sua conta' });
}

describe('Perfil', () => {
  it('mostra o nome, o e-mail (só leitura) e o avatar de iniciais', async () => {
    mockStudent();
    renderAppAt('/perfil');

    expect(
      await screen.findByRole('heading', { name: 'Perfil' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Aluno Teste');
    expect(screen.getByLabelText('E-mail')).toHaveValue('aluno@exemplo.com');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly');
    expect(screen.getByText('AT')).toBeInTheDocument();
    expect(screen.getByText('E-mail ainda não confirmado')).toBeInTheDocument();
    expect(screen.getByLabelText('Fuso horário')).toHaveValue(
      'America/Sao_Paulo',
    );
  });

  it('leva às subtelas e à assinatura', async () => {
    mockStudent();
    renderAppAt('/perfil');

    await screen.findByRole('heading', { name: 'Perfil' });

    expect(screen.getByRole('link', { name: /Estudo/ })).toHaveAttribute(
      'href',
      '/perfil/estudo',
    );
    expect(screen.getByRole('link', { name: /Notificações/ })).toHaveAttribute(
      'href',
      '/perfil/notificacoes',
    );
    expect(
      screen.getByRole('link', { name: /Privacidade e conta/ }),
    ).toHaveAttribute('href', '/perfil/privacidade');
    expect(
      screen.getByRole('link', { name: /Minha assinatura/ }),
    ).toHaveAttribute('href', '/minha-assinatura');
  });

  it('salvar manda só o que mudou: nome em PATCH /me, fuso em PATCH /me/profile', async () => {
    mockStudent();
    renderAppAt('/perfil');

    const save = await screen.findByRole('button', {
      name: 'Salvar alterações',
    });
    expect(save).toBeDisabled();

    const name = screen.getByLabelText('Nome');
    await userEvent.clear(name);
    await userEvent.type(name, 'Maria da Silva');
    await userEvent.selectOptions(
      screen.getByLabelText('Fuso horário'),
      'America/Manaus',
    );
    await userEvent.click(save);

    expect(await screen.findByText('Dados salvos')).toBeInTheDocument();
    expect(profileCalls.accountPatches).toEqual([{ name: 'Maria da Silva' }]);
    expect(profileCalls.profilePatches).toEqual([
      { timezone: 'America/Manaus' },
    ]);
    // O avatar acompanha o nome novo.
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('nome curto demais bloqueia o salvar', async () => {
    mockStudent();
    renderAppAt('/perfil');

    const name = await screen.findByLabelText('Nome');
    await userEvent.clear(name);
    await userEvent.type(name, 'A');

    expect(
      screen.getByText('Escreva um nome com pelo menos 2 letras.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    ).toBeDisabled();
  });

  it('falha ao salvar mostra o erro e não finge que salvou', async () => {
    mockStudent();
    server.use(
      http.patch(`${API_URL}/me`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Erro.' } },
          { status: 500 },
        ),
      ),
    );
    renderAppAt('/perfil');

    const name = await screen.findByLabelText('Nome');
    await userEvent.clear(name);
    await userEvent.type(name, 'Maria');
    await userEvent.click(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(
      await screen.findByText('Não conseguimos salvar agora. Tente de novo.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Dados salvos')).not.toBeInTheDocument();
  });

  it('Sair encerra a sessão e volta ao login', async () => {
    mockStudent();
    renderAppAt('/perfil');

    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await findLoginScreen()).toBeInTheDocument();
  });

  it('Sair de todos os dispositivos pede confirmação, chama a API e volta ao login', async () => {
    mockStudent();
    renderAppAt('/perfil');

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Sair de todos os dispositivos',
      }),
    );
    // Antes de confirmar, nada foi chamado.
    expect(await screen.findByText(/inclusive neste/)).toBeInTheDocument();
    expect(profileCalls.logoutAlls).toBe(0);

    await userEvent.click(
      screen.getByRole('button', { name: 'Sair de todos' }),
    );

    expect(await findLoginScreen()).toBeInTheDocument();
    expect(profileCalls.logoutAlls).toBe(1);
  });

  it('se o servidor não encerrar a sessão, avisa e continua logado', async () => {
    mockStudent();
    server.use(
      http.post(`${API_URL}/auth/logout`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Erro.' } },
          { status: 500 },
        ),
      ),
    );
    renderAppAt('/perfil');

    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByText(
        'Não conseguimos encerrar a sessão agora. Confira a conexão e tente de novo.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
  });
});
