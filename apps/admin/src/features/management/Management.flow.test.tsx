import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAdminAt } from '../curriculum/test-helpers';

/**
 * A história do administrador de ponta a ponta, no painel inteiro: acha a
 * aluna, abre a ficha, concede créditos com motivo, muda o custo de uma ação
 * e confere que as duas ações — e a abertura da ficha — ficaram no log.
 */
describe('Gestão: buscar → conceder → mudar custo → auditar', () => {
  it('cada ação do administrador deixa a sua linha no log', async () => {
    const user = userEvent.setup();

    renderAdminAt('/alunos', { role: 'ADMIN' });

    // 1. Busca e abre a ficha.
    await user.type(
      await screen.findByLabelText('Buscar por nome ou e-mail'),
      'ana.lima',
    );
    await user.click(
      await screen.findByRole('link', { name: 'Abrir ficha: Ana Lima' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Ana Lima' });

    // 2. Concede 25 créditos, com motivo.
    const credits = await screen.findByRole('region', {
      name: 'Créditos de IA',
    });

    await within(credits).findByText('496');
    await user.click(
      within(credits).getByRole('button', { name: 'Conceder créditos' }),
    );

    const dialog = await screen.findByRole('dialog');

    await user.type(
      within(dialog).getByLabelText('Quantidade de créditos'),
      '25',
    );
    await user.type(
      within(dialog).getByLabelText('Motivo'),
      'Compensação pelo erro do roleplay',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Conceder' }));
    expect(await within(credits).findByText('521')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // 3. Muda o custo do roleplay em Assinaturas.
    await user.click(screen.getByRole('link', { name: 'Assinaturas' }));

    const costs = await screen.findByRole('table', {
      name: 'Custo em créditos de cada ação',
    });
    const roleplay = within(costs).getByRole('row', {
      name: 'Roleplay (por sessão)',
    });
    const input = within(roleplay).getByLabelText(
      'Créditos por uso: Roleplay (por sessão)',
    );

    await user.clear(input);
    await user.type(input, '4');
    await user.click(
      within(roleplay).getByRole('button', {
        name: 'Salvar: Roleplay (por sessão)',
      }),
    );
    expect(await screen.findByText('Custo salvo.')).toBeInTheDocument();

    // 4. O log mostra as três, da mais nova para a mais antiga.
    await user.click(screen.getByRole('link', { name: 'Auditoria' }));

    const log = await screen.findByRole('table', {
      name: 'Ações de administração',
    });

    await waitFor(() =>
      expect(within(log).getAllByRole('row').length).toBeGreaterThanOrEqual(6),
    );

    const mine = within(log).getAllByRole('row').slice(1, 4);

    expect(
      within(mine[0] as HTMLElement).getByText('Alterou o custo de uma ação'),
    ).toBeInTheDocument();
    expect(
      within(mine[0] as HTMLElement).getByText(
        'Roleplay (por sessão): 3 → 4 créditos',
      ),
    ).toBeInTheDocument();
    expect(
      within(mine[1] as HTMLElement).getByText(
        '+25 créditos (saldo depois: 521) — motivo: Compensação pelo erro do roleplay',
      ),
    ).toBeInTheDocument();
    expect(
      within(mine[1] as HTMLElement).getByRole('link', {
        name: 'ana.lima@exemplo.com',
      }),
    ).toBeInTheDocument();
    expect(
      within(mine[2] as HTMLElement).getByText('Abriu a ficha de um aluno'),
    ).toBeInTheDocument();

    for (const row of mine) {
      expect(within(row).getByText('admin@exemplo.com')).toBeInTheDocument();
    }
  });
});
