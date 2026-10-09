import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openStudents() {
  const view = renderAdminAt('/alunos', { role: 'ADMIN' });
  await screen.findByRole('table', { name: 'Alunos cadastrados' });

  return view;
}

const rowOf = (name: string) => screen.getByRole('row', { name });

describe('Alunos', () => {
  it('lista do mais novo ao mais antigo, com papel e situação da conta', async () => {
    await openStudents();

    const rows = screen.getAllByRole('row').slice(1);

    expect(rows).toHaveLength(25);
    expect(rows[0]).toHaveAccessibleName('Ana Lima');

    const ana = rowOf('Ana Lima');

    expect(within(ana).getByText('ana.lima@exemplo.com')).toBeInTheDocument();
    expect(within(ana).getByText('Aluno')).toBeInTheDocument();
    expect(within(ana).getByText('Ativa')).toBeInTheDocument();

    expect(
      within(rowOf('Bruno Costa')).getByText('E-mail não verificado'),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Carla Dias')).getByText('Exclusão pedida'),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Conta anonimizada')).getByText('Anonimizada'),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Editora Teste')).getByText('Editor de conteúdo'),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Admin Silva')).getByText('Administrador'),
    ).toBeInTheDocument();
  });

  it('"Carregar mais" traz o resto, sem repetir ninguém', async () => {
    const user = userEvent.setup();

    await openStudents();
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(25);

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() =>
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(30),
    );
    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Aluno 24' })).toBeInTheDocument();
  });

  it('busca por nome ou por e-mail, sem diferença de caixa', async () => {
    const user = userEvent.setup();

    await openStudents();

    await user.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'ANA');

    await waitFor(() =>
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(1),
    );
    expect(screen.getByRole('row', { name: 'Ana Lima' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Buscar por nome ou e-mail'));
    await user.type(
      screen.getByLabelText('Buscar por nome ou e-mail'),
      'bruno@exe',
    );

    expect(
      await screen.findByRole('row', { name: 'Bruno Costa' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
  });

  it('sem resultado, diz o que foi buscado e deixa limpar a busca', async () => {
    const user = userEvent.setup();

    await openStudents();

    await user.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'zzzz');

    expect(
      await screen.findByText('Ninguém encontrado para "zzzz".'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar a busca' }));

    await screen.findByRole('table', { name: 'Alunos cadastrados' });
    expect(screen.getByLabelText('Buscar por nome ou e-mail')).toHaveValue('');
  });

  it('abre a ficha do aluno pelo botão da linha', async () => {
    const user = userEvent.setup();

    await openStudents();

    await user.click(
      screen.getByRole('link', { name: 'Abrir ficha: Ana Lima' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/alunos/student-ana',
      ),
    );
  });

  it('erro na lista: mostra a mensagem e tenta de novo', async () => {
    const user = userEvent.setup();

    failNext('users-list', {
      status: 429,
      code: 'THROTTLED',
      message: 'Muitos pedidos. Espere um instante.',
    });
    renderAdminAt('/alunos', { role: 'ADMIN' });

    expect(
      await screen.findByText('Muitos pedidos. Espere um instante.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await screen.findByRole('table', { name: 'Alunos cadastrados' });
  });
});
