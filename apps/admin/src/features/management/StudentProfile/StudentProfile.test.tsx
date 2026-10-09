import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  STUDENT_ANA_ID,
  STUDENT_BRUNO_ID,
  STUDENT_CARLA_ID,
  STUDENT_DORA_ID,
  adminState,
} from '../../../mocks/admin-mock';
import { failNext } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openProfile(id: string) {
  const view = renderAdminAt(`/alunos/${id}`, { role: 'ADMIN' });
  await screen.findByRole('link', { name: 'Voltar para os alunos' });

  return view;
}

const region = (name: string) => screen.findByRole('region', { name });

/** Bônus dados nesta sessão (o log de partida já tem um, de outra pessoa). */
const myBonuses = () =>
  adminState.audit.filter(
    (entry) =>
      entry.action === 'credits.bonus' &&
      entry.actorEmail === 'admin@exemplo.com',
  );

describe('Ficha do aluno', () => {
  it('mostra a conta, o perfil de estudo e deixa rastro de quem abriu', async () => {
    await openProfile(STUDENT_ANA_ID);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ana Lima' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ana.lima@exemplo.com')).toBeInTheDocument();
    expect(screen.getAllByText('Ativa').length).toBeGreaterThan(0);
    expect(screen.getByText('Viajar')).toBeInTheDocument();
    expect(screen.getByText('Trabalho')).toBeInTheDocument();
    expect(screen.getByText('history')).toBeInTheDocument();
    expect(
      screen.getByText('Nível que o aluno declarou: Sei o básico'),
    ).toBeInTheDocument();
    expect(screen.getByText('Fuso: America/Sao_Paulo')).toBeInTheDocument();

    const last = adminState.audit.at(-1);

    expect(last).toMatchObject({
      action: 'student.view',
      targetId: STUDENT_ANA_ID,
      actorEmail: 'admin@exemplo.com',
    });
  });

  it('nível por competência: barras com o nível e o aviso de poucos dados', async () => {
    await openProfile(STUDENT_ANA_ID);

    const level = await region('Nível por competência');

    expect(
      within(level).getByText('Nível geral: A2 — Básico'),
    ).toBeInTheDocument();

    // O gráfico traz os mesmos números numa tabela.
    const rows = within(level).getAllByRole('row');
    const grammar = rows.find((row) => within(row).queryByText('Gramática'));

    expect(grammar).toBeDefined();
    expect(within(grammar as HTMLElement).getByText(/B1/)).toBeInTheDocument();

    const listening = rows.find((row) => within(row).queryByText('Escuta'));

    expect(
      within(listening as HTMLElement).getByText(/Poucos dados/),
    ).toBeInTheDocument();

    const speaking = rows.find((row) => within(row).queryByText('Fala'));

    expect(
      within(speaking as HTMLElement).getByText('Sem dados ainda'),
    ).toBeInTheDocument();
  });

  it('pontos fortes, fracos e erros recorrentes', async () => {
    await openProfile(STUDENT_ANA_ID);

    const strengths = await region('Pontos fortes e fracos');

    expect(within(strengths).getByText('Se apresentar')).toBeInTheDocument();
    expect(within(strengths).getByText('Passado simples')).toBeInTheDocument();
    expect(within(strengths).getByText('Artigos')).toBeInTheDocument();
    expect(
      within(strengths).getByText(
        'Dizer "I have 20 years" em vez de "I am 20 years old"',
      ),
    ).toBeInTheDocument();
    expect(
      within(strengths).getByText('3 em 12 oportunidades · Está diminuindo'),
    ).toBeInTheDocument();
  });

  it('plano de estudos: alvo, previsão, ritmo, próximas lições e reforço', async () => {
    await openProfile(STUDENT_ANA_ID);

    const plan = await region('Plano de estudos');

    expect(within(plan).getByText('Nível-alvo: B1')).toBeInTheDocument();
    expect(within(plan).getByText('Data-alvo: 15/12/2026')).toBeInTheDocument();
    expect(
      within(plan).getByText(/No ritmo planejado, chega ao B1 em dezembro/),
    ).toBeInTheDocument();
    expect(
      within(plan).getByText(/Quatro semanas atrás do plano/),
    ).toBeInTheDocument();
    expect(
      within(plan).getByText(/Estudou 340 min · 6 lições · 48 revisões/),
    ).toBeInTheDocument();
    expect(within(plan).getByText('Lição do plano 1')).toBeInTheDocument();
    expect(within(plan).getByText('e mais 4 lições')).toBeInTheDocument();
    expect(within(plan).getByText('grammar.past-simple')).toBeInTheDocument();
    // Planejado × estudado por semana, em tabela.
    expect(
      within(plan).getAllByText('Planejado × estudado por semana').length,
    ).toBeGreaterThan(0);
  });

  it('histórico: primeira página e "Carregar mais"', async () => {
    const user = userEvent.setup();

    await openProfile(STUDENT_ANA_ID);

    const history = await region('Histórico de lições');
    const table = await within(history).findByRole('table', {
      name: 'Lições que o aluno fez',
    });

    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(20);
    expect(within(table).getAllByText('Concluída').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Abandonada').length).toBeGreaterThan(0);

    await user.click(
      within(history).getByRole('button', { name: 'Carregar mais' }),
    );

    await waitFor(() =>
      expect(within(table).getAllByRole('row').slice(1)).toHaveLength(23),
    );
  });

  it('assinatura: plano, situação, preço, pagamento e até quando tem acesso', async () => {
    await openProfile(STUDENT_ANA_ID);

    const subscription = await region('Assinatura');

    expect(await within(subscription).findByText('Ativa')).toBeInTheDocument();
    expect(within(subscription).getByText('Plus')).toBeInTheDocument();
    expect(
      within(subscription).getByText('R$ 69,90 por mês'),
    ).toBeInTheDocument();
    expect(within(subscription).getByText('Pix')).toBeInTheDocument();
  });

  it('créditos: saldo, cota, custo por uso e extrato', async () => {
    await openProfile(STUDENT_ANA_ID);

    const credits = await region('Créditos de IA');

    expect(await within(credits).findByText('496')).toBeInTheDocument();
    expect(within(credits).getByText('500')).toBeInTheDocument();
    expect(
      within(credits).getByText('Roleplay (por sessão): 3'),
    ).toBeInTheDocument();

    const ledger = await within(credits).findByRole('table', {
      name: 'Extrato de créditos do aluno',
    });
    const rows = within(ledger).getAllByRole('row').slice(1);

    // Mais recente primeiro.
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByText('Uso')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('-1')).toBeInTheDocument();
    expect(
      within(rows[2] as HTMLElement).getByText('Crédito do ciclo'),
    ).toBeInTheDocument();
  });

  it('uso de IA: totais e por recurso', async () => {
    await openProfile(STUDENT_ANA_ID);

    const usage = await region('Uso de IA');

    expect(await within(usage).findByText('14')).toBeInTheDocument();
    expect(within(usage).getByText('US$ 0,0615')).toBeInTheDocument();
    expect(within(usage).getByText('Correção de escrita')).toBeInTheDocument();
    expect(within(usage).getByText('Roleplay (turno)')).toBeInTheDocument();
  });

  it('aluno novo: cada parte diz o que falta, sem gráfico vazio', async () => {
    await openProfile(STUDENT_BRUNO_ID);

    expect(
      await screen.findByText('O aluno ainda não fez o onboarding.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('O aluno ainda não tem plano de estudos.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('O aluno ainda não fez nenhuma lição.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Sem assinatura: plano gratuito.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('O aluno ainda não usou IA.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Nenhum ponto forte identificado ainda.'),
    ).toBeInTheDocument();
  });

  it('conta com exclusão pedida e conta anonimizada explicam a situação', async () => {
    await openProfile(STUDENT_CARLA_ID);

    expect(
      await screen.findByText(/pediu a exclusão da conta em 03\/10\/2026/),
    ).toBeInTheDocument();
  });

  it('conta anonimizada: dados pessoais já apagados', async () => {
    await openProfile(STUDENT_DORA_ID);

    expect(
      await screen.findByText(/Os dados pessoais já foram apagados/),
    ).toBeInTheDocument();
    expect(screen.getByText('Anonimizada')).toBeInTheDocument();
  });

  it('uma parte que falha mostra o erro no lugar dela e as outras seguem', async () => {
    const user = userEvent.setup();

    failNext('student-plan', {
      status: 404,
      code: 'NOT_FOUND',
      message: 'Não foi possível ler o plano.',
    });
    await openProfile(STUDENT_ANA_ID);

    const plan = await region('Plano de estudos');

    expect(
      await within(plan).findByText('Não foi possível ler o plano.'),
    ).toBeInTheDocument();
    // O resto da ficha carregou normalmente.
    expect(
      await within(await region('Assinatura')).findByText('Ativa'),
    ).toBeInTheDocument();
    expect(
      await within(await region('Créditos de IA')).findByText('496'),
    ).toBeInTheDocument();

    await user.click(
      within(plan).getByRole('button', { name: 'Tentar de novo' }),
    );

    expect(await within(plan).findByText('Nível-alvo: B1')).toBeInTheDocument();
  });

  it('aluno que não existe: erro da ficha, com a mensagem do servidor', async () => {
    renderAdminAt('/alunos/ninguem', { role: 'ADMIN' });

    expect(
      await screen.findByText('Não foi possível abrir a ficha'),
    ).toBeInTheDocument();
    expect(screen.getByText('Não encontramos este aluno.')).toBeInTheDocument();
    // E abrir ficha que não existe não deixa rastro de "visualização".
    expect(adminState.audit.map((entry) => entry.targetId)).not.toContain(
      'ninguem',
    );
  });
});

describe('Conceder créditos', () => {
  async function openGrant() {
    const user = userEvent.setup();

    await openProfile(STUDENT_ANA_ID);

    const credits = await region('Créditos de IA');

    await within(credits).findByText('496');
    await user.click(
      within(credits).getByRole('button', { name: 'Conceder créditos' }),
    );

    return { user, dialog: await screen.findByRole('dialog') };
  }

  it('o motivo é obrigatório e os erros aparecem só depois de tentar', async () => {
    const { user, dialog } = await openGrant();

    expect(
      within(dialog).queryByText('O motivo é obrigatório.'),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    expect(
      await within(dialog).findByText('Informe um número inteiro.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('O motivo é obrigatório.'),
    ).toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText('Quantidade de créditos'),
      '0',
    );
    await user.type(within(dialog).getByLabelText('Motivo'), '   ');

    expect(
      within(dialog).getByText('Use de 1 a 10000 créditos.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('O motivo é obrigatório.'),
    ).toBeInTheDocument();

    // Nada foi enviado nem auditado como bônus.
    expect(myBonuses()).toHaveLength(0);
  });

  it('concede: mostra o saldo de depois, soma ao saldo, entra no extrato e na auditoria', async () => {
    const { user, dialog } = await openGrant();

    await user.type(
      within(dialog).getByLabelText('Quantidade de créditos'),
      '25',
    );
    await user.type(
      within(dialog).getByLabelText('Motivo'),
      '  Compensação pelo erro do roleplay  ',
    );

    expect(
      within(dialog).getByText('O saldo vai de 496 para 521.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    expect(
      await screen.findByText('Créditos concedidos. Saldo: 521.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const credits = await region('Créditos de IA');

    expect(await within(credits).findByText('521')).toBeInTheDocument();

    const ledger = await within(credits).findByRole('table', {
      name: 'Extrato de créditos do aluno',
    });
    const first = within(ledger).getAllByRole('row')[1] as HTMLElement;

    expect(within(first).getByText('Bônus do admin')).toBeInTheDocument();
    expect(within(first).getByText('+25')).toBeInTheDocument();
    expect(
      within(first).getByText('Compensação pelo erro do roleplay'),
    ).toBeInTheDocument();

    expect(adminState.audit.at(-1)).toMatchObject({
      action: 'credits.bonus',
      actorEmail: 'admin@exemplo.com',
      targetId: STUDENT_ANA_ID,
      details: {
        amount: 25,
        reason: 'Compensação pelo erro do roleplay',
        balanceAfter: 521,
      },
    });
  });

  it('se o servidor recusar, o motivo aparece no diálogo e o saldo não muda', async () => {
    const { user, dialog } = await openGrant();

    failNext('bonus-grant', {
      status: 404,
      code: 'NOT_FOUND',
      message: 'Aluno não encontrado.',
    });
    await user.type(
      within(dialog).getByLabelText('Quantidade de créditos'),
      '5',
    );
    await user.type(within(dialog).getByLabelText('Motivo'), 'Teste');
    await user.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    expect(
      await within(dialog).findByText(
        'Não foi possível conceder os créditos: Aluno não encontrado.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Com o diálogo aberto o resto da página fica "escondido" para leitores de tela.
    expect(
      within(
        screen.getByRole('region', { name: 'Créditos de IA', hidden: true }),
      ).getByText('496'),
    ).toBeInTheDocument();
    expect(myBonuses()).toHaveLength(0);
  });

  it('cancelar fecha e limpa o formulário', async () => {
    const { user, dialog } = await openGrant();

    await user.type(within(dialog).getByLabelText('Motivo'), 'Rascunho');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Conceder créditos' }));

    expect(
      within(await screen.findByRole('dialog')).getByLabelText('Motivo'),
    ).toHaveValue('');
  });
});
