import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { STUDENT_BRUNO_ID, adminState } from '../../../mocks/admin-mock';
import { failNext } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openAudit() {
  renderAdminAt('/auditoria', { role: 'ADMIN' });
  await screen.findByRole('table', { name: 'Ações de administração' });
}

const entries = () => screen.getAllByRole('row').slice(1) as HTMLElement[];

describe('Log de auditoria', () => {
  it('lista do mais recente ao mais antigo: quem, o quê, em quem e o que mudou', async () => {
    await openAudit();

    expect(entries()).toHaveLength(2);

    // O bônus (dia 3) vem antes da mudança de plano (dia 2).
    const bonus = entries()[0] as HTMLElement;

    expect(within(bonus).getByText('marta@exemplo.com')).toBeInTheDocument();
    expect(within(bonus).getByText('Concedeu créditos')).toBeInTheDocument();
    expect(
      within(bonus).getByRole('link', { name: 'bruno@exemplo.com' }),
    ).toHaveAttribute('href', `/alunos/${STUDENT_BRUNO_ID}`);
    expect(
      within(bonus).getByText(
        '+5 créditos (saldo depois: 15) — motivo: Teste da cota gratuita',
      ),
    ).toBeInTheDocument();

    const plan = entries()[1] as HTMLElement;

    expect(within(plan).getByText('Alterou um plano')).toBeInTheDocument();
    expect(within(plan).getByText('Base mensal')).toBeInTheDocument();
    expect(
      within(plan).getByText('preço: R$ 29,90 → R$ 39,90'),
    ).toBeInTheDocument();
  });

  it('ação feita agora aparece no topo, com o nome de quem fez', async () => {
    adminState.audit.push({
      id: 'aud-x',
      actorId: 'admin-1',
      actorEmail: 'admin@exemplo.com',
      action: 'credit-cost.update',
      targetType: 'credit_cost',
      targetId: 'TUTOR_ROLEPLAY',
      details: { feature: 'TUTOR_ROLEPLAY', from: 3, to: 4 },
      requestId: null,
      createdAt: '2026-10-08T13:00:00.000Z',
    });
    await openAudit();

    const top = entries()[0] as HTMLElement;

    expect(within(top).getByText('admin@exemplo.com')).toBeInTheDocument();
    expect(
      within(top).getByText('Alterou o custo de uma ação'),
    ).toBeInTheDocument();
    expect(
      within(top).getByText('Roleplay (por sessão): 3 → 4 créditos'),
    ).toBeInTheDocument();
    expect(within(top).getByText('Custo de ação')).toBeInTheDocument();
  });

  it('filtra por ação e limpa os filtros', async () => {
    const user = userEvent.setup();

    await openAudit();
    await user.selectOptions(screen.getByLabelText('Ação'), 'plan.update');

    await waitFor(() => expect(entries()).toHaveLength(1));
    expect(
      within(entries()[0] as HTMLElement).getByText('Alterou um plano'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    await waitFor(() => expect(entries()).toHaveLength(2));
    expect(screen.getByLabelText('Ação')).toHaveValue('');
  });

  it('filtra por dia, no fuso de quem olha', async () => {
    const user = userEvent.setup();

    await openAudit();

    // Nenhuma ação em 2026-01-01.
    await user.type(screen.getByLabelText('De'), '2026-01-01');
    await user.type(screen.getByLabelText('Até'), '2026-01-01');

    expect(
      await screen.findByText('Nenhuma ação com esses filtros.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await screen.findByRole('table', { name: 'Ações de administração' });
  });

  it('muita coisa: pagina com "Carregar mais"', async () => {
    const user = userEvent.setup();

    for (let index = 0; index < 33; index += 1) {
      adminState.audit.push({
        id: `aud-bulk-${String(index)}`,
        actorId: 'admin-1',
        actorEmail: 'admin@exemplo.com',
        action: 'student.view',
        targetType: 'user',
        targetId: STUDENT_BRUNO_ID,
        details: {},
        requestId: null,
        createdAt: new Date(Date.UTC(2026, 9, 8, 10, index)).toISOString(),
      });
    }
    await openAudit();

    expect(entries()).toHaveLength(30);

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() => expect(entries()).toHaveLength(35));
    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
    ).not.toBeInTheDocument();
  });

  it('sem nada registrado, diz isso', async () => {
    adminState.audit.length = 0;
    renderAdminAt('/auditoria', { role: 'ADMIN' });

    expect(await screen.findByText('Nada registrado')).toBeInTheDocument();
    expect(
      screen.getByText('Nenhuma ação de administração ainda.'),
    ).toBeInTheDocument();
  });

  it('erro na leitura: tenta de novo', async () => {
    const user = userEvent.setup();

    failNext('audit-list', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Sem permissão para ver o log.',
    });
    renderAdminAt('/auditoria', { role: 'ADMIN' });

    expect(
      await screen.findByText('Sem permissão para ver o log.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await screen.findByRole('table', { name: 'Ações de administração' });
  });
});
