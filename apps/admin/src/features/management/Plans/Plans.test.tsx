import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PLAN_PLUS_ID, adminState } from '../../../mocks/admin-mock';
import { failNext } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openPlans() {
  renderAdminAt('/assinaturas', { role: 'ADMIN' });
  await screen.findByRole('table', { name: 'Planos' });
}

const planRow = (name: string) => screen.getByRole('row', { name });
const costRow = (name: string) => screen.getByRole('row', { name });

const lastAudit = () => adminState.audit.at(-1);

describe('Planos', () => {
  it('lista cada plano com preço, cota e se está à venda', async () => {
    await openPlans();

    const plus = planRow('Plus mensal');

    expect(within(plus).getByLabelText('Preço (R$): Plus mensal')).toHaveValue(
      '69,90',
    );
    expect(
      within(plus).getByLabelText('Cota mensal (créditos): Plus mensal'),
    ).toHaveValue('500');
    expect(within(plus).getByLabelText('À venda: Plus mensal')).toBeChecked();

    // O gratuito não tem preço nem liga/desliga.
    const free = planRow('Gratuito');

    expect(within(free).getByText('Sem preço')).toBeInTheDocument();
    expect(
      within(free).queryByLabelText(/Preço \(R\$\)/),
    ).not.toBeInTheDocument();
    expect(
      within(free).getByLabelText('Cota mensal (créditos): Gratuito'),
    ).toHaveValue('10');

    // Plano fora de venda aparece avisado.
    const yearly = planRow('Base anual');

    expect(
      within(yearly).getByLabelText('À venda: Base anual'),
    ).not.toBeChecked();
  });

  it('só salva depois de mudar algo, e manda o preço em centavos', async () => {
    const user = userEvent.setup();

    await openPlans();

    const plus = planRow('Plus mensal');
    const save = within(plus).getByRole('button', {
      name: 'Salvar: Plus mensal',
    });

    expect(save).toBeDisabled();

    const price = within(plus).getByLabelText('Preço (R$): Plus mensal');

    await user.clear(price);
    await user.type(price, '79,90');
    expect(save).toBeEnabled();
    await user.click(save);

    expect(await screen.findByText('Plano salvo.')).toBeInTheDocument();
    expect(adminState.plans.find((p) => p.id === PLAN_PLUS_ID)).toMatchObject({
      priceCents: 7990,
      monthlyAiCredits: 500,
      active: true,
    });

    // A linha recomeça refletindo o servidor: nada pendente para salvar.
    await waitFor(() =>
      expect(
        within(planRow('Plus mensal')).getByRole('button', {
          name: 'Salvar: Plus mensal',
        }),
      ).toBeDisabled(),
    );
    expect(
      within(planRow('Plus mensal')).getByText('R$ 79,90 por mês'),
    ).toBeInTheDocument();
  });

  it('a mudança entra no log de auditoria só com os campos que mudaram', async () => {
    const user = userEvent.setup();

    await openPlans();

    const plus = planRow('Plus mensal');
    const credits = within(plus).getByLabelText(
      'Cota mensal (créditos): Plus mensal',
    );

    await user.clear(credits);
    await user.type(credits, '600');
    await user.click(within(plus).getByLabelText('À venda: Plus mensal'));
    await user.click(
      within(plus).getByRole('button', { name: 'Salvar: Plus mensal' }),
    );

    await screen.findByText('Plano salvo.');

    expect(lastAudit()).toMatchObject({
      action: 'plan.update',
      targetId: PLAN_PLUS_ID,
      actorEmail: 'admin@exemplo.com',
      details: {
        tier: 'PLUS',
        billingPeriod: 'MONTHLY',
        changes: {
          monthlyAiCredits: { from: 500, to: 600 },
          active: { from: true, to: false },
        },
      },
    });
    expect(
      Object.keys(
        (lastAudit()?.details as { changes: Record<string, unknown> }).changes,
      ),
    ).toEqual(['monthlyAiCredits', 'active']);
  });

  it('valor inválido: mostra o erro no campo e não manda nada', async () => {
    const user = userEvent.setup();

    await openPlans();

    const before = adminState.audit.length;
    const plus = planRow('Plus mensal');
    const price = within(plus).getByLabelText('Preço (R$): Plus mensal');

    await user.clear(price);
    await user.type(price, 'muito caro');
    await user.click(
      within(plus).getByRole('button', { name: 'Salvar: Plus mensal' }),
    );

    expect(
      await within(plus).findByText('Informe um valor em reais, como 69,90.'),
    ).toBeInTheDocument();

    const credits = within(plus).getByLabelText(
      'Cota mensal (créditos): Plus mensal',
    );

    await user.clear(credits);
    await user.type(credits, '1,5');
    await user.click(
      within(plus).getByRole('button', { name: 'Salvar: Plus mensal' }),
    );

    expect(
      await within(plus).findByText('Informe um número inteiro de créditos.'),
    ).toBeInTheDocument();
    expect(adminState.audit).toHaveLength(before);
    expect(
      adminState.plans.find((p) => p.id === PLAN_PLUS_ID)?.priceCents,
    ).toBe(6990);
  });

  it('se o servidor recusar, avisa e mantém o que foi digitado', async () => {
    const user = userEvent.setup();

    await openPlans();

    failNext('plan-update', {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Informe ao menos um campo para alterar.',
    });

    const plus = planRow('Plus mensal');
    const price = within(plus).getByLabelText('Preço (R$): Plus mensal');

    await user.clear(price);
    await user.type(price, '80');
    await user.click(
      within(plus).getByRole('button', { name: 'Salvar: Plus mensal' }),
    );

    expect(
      await screen.findByText('Não foi possível salvar o plano'),
    ).toBeInTheDocument();
    expect(price).toHaveValue('80');
  });

  it('erro ao listar: tenta de novo', async () => {
    const user = userEvent.setup();

    failNext('plans-list', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Sem permissão.',
    });
    renderAdminAt('/assinaturas', { role: 'ADMIN' });

    expect(await screen.findByText('Sem permissão.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await screen.findByRole('table', { name: 'Planos' });
  });
});

describe('Custo em créditos por ação', () => {
  async function openCosts() {
    await openPlans();

    return screen.findByRole('table', {
      name: 'Custo em créditos de cada ação',
    });
  }

  it('lista as quatro ações com o custo de hoje', async () => {
    await openCosts();

    expect(
      within(costRow('Correção de escrita')).getByLabelText(
        'Créditos por uso: Correção de escrita',
      ),
    ).toHaveValue('1');
    expect(
      within(costRow('Roleplay (por sessão)')).getByLabelText(
        'Créditos por uso: Roleplay (por sessão)',
      ),
    ).toHaveValue('3');
    expect(
      within(costRow('Material a partir de um tema')).getByLabelText(
        'Créditos por uso: Material a partir de um tema',
      ),
    ).toHaveValue('5');
    expect(
      within(costRow('Material a partir de um conteúdo colado')).getByLabelText(
        'Créditos por uso: Material a partir de um conteúdo colado',
      ),
    ).toHaveValue('5');
  });

  it('muda o custo, vale na hora e fica na auditoria com o antes e o depois', async () => {
    const user = userEvent.setup();

    await openCosts();

    const row = costRow('Roleplay (por sessão)');
    const input = within(row).getByLabelText(
      'Créditos por uso: Roleplay (por sessão)',
    );

    await user.clear(input);
    await user.type(input, '4');
    await user.click(
      within(row).getByRole('button', {
        name: 'Salvar: Roleplay (por sessão)',
      }),
    );

    expect(await screen.findByText('Custo salvo.')).toBeInTheDocument();
    expect(adminState.costs['TUTOR_ROLEPLAY']).toBe(4);
    expect(lastAudit()).toMatchObject({
      action: 'credit-cost.update',
      targetType: 'credit_cost',
      targetId: 'TUTOR_ROLEPLAY',
      details: { feature: 'TUTOR_ROLEPLAY', from: 3, to: 4 },
    });
  });

  it('só aceita inteiro de 1 a 100', async () => {
    const user = userEvent.setup();

    await openCosts();

    const row = costRow('Correção de escrita');
    const input = within(row).getByLabelText(
      'Créditos por uso: Correção de escrita',
    );
    const save = within(row).getByRole('button', {
      name: 'Salvar: Correção de escrita',
    });

    for (const bad of ['0', '101', '2,5', 'abc']) {
      await user.clear(input);
      await user.type(input, bad);
      await user.click(save);

      expect(
        await within(row).findByText('Informe um número inteiro de 1 a 100.'),
      ).toBeInTheDocument();
    }

    expect(adminState.costs['TUTOR_CORRECTION']).toBe(1);
    expect(adminState.audit.map((entry) => entry.action)).not.toContain(
      'credit-cost.update',
    );
  });

  it('erro do servidor: avisa e não perde o que foi digitado', async () => {
    const user = userEvent.setup();

    await openCosts();

    failNext('credit-cost-update', {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'O custo deve ser um inteiro de 1 a 100.',
    });

    const row = costRow('Correção de escrita');
    const input = within(row).getByLabelText(
      'Créditos por uso: Correção de escrita',
    );

    await user.clear(input);
    await user.type(input, '7');
    await user.click(
      within(row).getByRole('button', { name: 'Salvar: Correção de escrita' }),
    );

    expect(
      await screen.findByText('Não foi possível salvar o custo'),
    ).toBeInTheDocument();
    expect(input).toHaveValue('7');
  });
});
