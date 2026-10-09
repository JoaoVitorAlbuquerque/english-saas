import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { adminState } from '../../../mocks/admin-mock';
import { failNext } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openMetrics(path = '/metricas') {
  renderAdminAt(path, { role: 'ADMIN' });
  await screen.findByRole('tab', { name: 'Engajamento' });
}

const periodText = (text: string) => screen.findByText(text);

describe('Métricas — período', () => {
  it('abre nos 30 dias até ontem, como a API devolve', async () => {
    await openMetrics();

    expect(
      await periodText('Mostrando de 08/09/2026 até 07/10/2026 (30 dias).'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Últimos 30 dias' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Primeira leitura é a do padrão (sem datas).
    expect(adminState.metricsRequests[0]).toBeNull();
  });

  it('os atalhos refazem a leitura terminando no mesmo dia', async () => {
    const user = userEvent.setup();

    await openMetrics();
    await user.click(screen.getByRole('button', { name: 'Últimos 7 dias' }));

    expect(
      await periodText('Mostrando de 01/10/2026 até 07/10/2026 (7 dias).'),
    ).toBeInTheDocument();
    expect(adminState.metricsRequests.at(-1)).toEqual({
      from: '2026-10-01',
      to: '2026-10-07',
    });
    expect(
      screen.getByRole('button', { name: 'Últimos 7 dias' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Últimos 90 dias' }));

    expect(
      await periodText(
        'Mostrando de 10/07/2026 até 07/10/2026 (90 dias).'.replace(
          '10/07',
          '10/07',
        ),
      ),
    ).toBeInTheDocument();

    // Voltar ao padrão limpa as datas.
    await user.click(screen.getByRole('button', { name: 'Últimos 30 dias' }));

    expect(
      await periodText('Mostrando de 08/09/2026 até 07/10/2026 (30 dias).'),
    ).toBeInTheDocument();
  });

  it('intervalo livre: confere antes de mandar', async () => {
    const user = userEvent.setup();

    await openMetrics();
    await user.click(screen.getByRole('button', { name: 'Personalizado' }));

    const from = screen.getByLabelText('De');
    const to = screen.getByLabelText('Até');
    const calls = adminState.metricsRequests.length;

    await user.clear(from);
    await user.clear(to);
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(
      await screen.findByText('Informe as duas datas.'),
    ).toBeInTheDocument();

    await user.type(from, '2026-10-05');
    await user.type(to, '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(
      await screen.findByText('A data inicial precisa vir antes da final.'),
    ).toBeInTheDocument();

    await user.clear(from);
    await user.type(from, '2026-01-01');
    await user.clear(to);
    await user.type(to, '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(
      await screen.findByText('O período pode ter no máximo 180 dias.'),
    ).toBeInTheDocument();

    // Nada disso chegou à API.
    expect(adminState.metricsRequests).toHaveLength(calls);

    await user.clear(from);
    await user.type(from, '2026-09-01');
    await user.clear(to);
    await user.type(to, '2026-09-10');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(
      await periodText('Mostrando de 01/09/2026 até 10/09/2026 (10 dias).'),
    ).toBeInTheDocument();
    expect(adminState.metricsRequests.at(-1)).toEqual({
      from: '2026-09-01',
      to: '2026-09-10',
    });
  });
});

describe('Métricas — engajamento', () => {
  it('ativos por dia/semana/mês, conclusão e abandono', async () => {
    await openMetrics();

    const tiles = await screen.findByRole('region', {
      name: 'Engajamento',
    });

    expect(within(tiles).getByText('Ativos no último dia')).toBeInTheDocument();
    expect(within(tiles).getByText('Ativos na semana')).toBeInTheDocument();
    expect(within(tiles).getByText('Ativos no mês')).toBeInTheDocument();
    expect(within(tiles).getByText('Taxa de conclusão')).toBeInTheDocument();
    expect(within(tiles).getByText('Abandonos')).toBeInTheDocument();
  });

  it('cada gráfico traz a tabela alternativa com os mesmos números', async () => {
    await openMetrics();

    for (const name of [
      'Alunos ativos por dia',
      'Lições iniciadas × concluídas',
      'Abandono por etapa da lição',
    ]) {
      const figure = await screen.findByRole('figure', { name });

      expect(within(figure).getByText('Ver como tabela')).toBeInTheDocument();
      expect(within(figure).getByRole('table', { name })).toBeInTheDocument();
    }

    // Uma linha por dia do período (30 dias), com os três contadores.
    const active = screen.getByRole('table', { name: 'Alunos ativos por dia' });

    expect(within(active).getAllByRole('row').slice(1)).toHaveLength(30);
  });

  it('retenção por coorte semanal: a matriz traz o número e deixa vazia a semana que não aconteceu', async () => {
    await openMetrics();

    const table = await screen.findByRole('table', {
      name: 'Retenção por coorte',
    });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(4);

    const first = rows[0] as HTMLElement;

    expect(within(first).getByRole('rowheader')).toHaveTextContent(
      '14/09/2026',
    );
    expect(within(first).getByText('12')).toBeInTheDocument();
    expect(within(first).getByText('100%')).toBeInTheDocument();
    expect(within(first).getByText('50%')).toBeInTheDocument();
    expect(within(first).getByText('8%')).toBeInTheDocument();

    // A coorte mais nova só tem a semana 0; as outras colunas ficam vazias.
    const last = rows[3] as HTMLElement;

    expect(within(last).getAllByText('100%')).toHaveLength(1);
    expect(within(last).getAllByText('—')).toHaveLength(3);
  });

  it('abandono por etapa: a etapa e o tipo', async () => {
    await openMetrics();

    const table = await screen.findByRole('table', {
      name: 'Abandono por etapa da lição',
    });

    expect(within(table).getByText(/^Etapa 3 · /)).toBeInTheDocument();
    expect(within(table).getByText(/^Etapa 5 · /)).toBeInTheDocument();
    expect(
      within(table).getByText('Etapa 6 · tipo desconhecido'),
    ).toBeInTheDocument();
  });
});

describe('Métricas — conteúdo', () => {
  it('lições com pior desempenho e itens problemáticos com link ao editor', async () => {
    const user = userEvent.setup();

    await openMetrics();
    await user.click(screen.getByRole('tab', { name: 'Conteúdo' }));

    const worst = await screen.findByRole('table', {
      name: 'Lições com pior desempenho',
    });
    const hard = within(worst).getByRole('row', {
      name: 'Past simple: irregulares',
    });

    expect(within(hard).getByText('45%')).toBeInTheDocument();
    expect(within(hard).getByText('52%')).toBeInTheDocument();
    expect(within(hard).getByText(/Etapa 3 · /)).toBeInTheDocument();

    const dull = within(worst).getByRole('row', { name: 'At the airport' });

    expect(within(dull).getByText('sem respostas')).toBeInTheDocument();

    const items = await screen.findByRole('table', {
      name: 'Questões marcadas pela calibração',
    });
    const easy = within(items).getByRole('row', { name: 'I ___ a student.' });

    expect(
      within(easy).getByText('Fácil demais (mais de 95% acertam)'),
    ).toBeInTheDocument();
    expect(
      within(easy).getByRole('link', {
        name: 'Abrir questão: I ___ a student.',
      }),
    ).toHaveAttribute(
      'href',
      '/conteudo/questoes/44444444-4444-4444-8444-444444444444',
    );

    const hardItem = within(items).getByRole('row', {
      name: 'Ordene: she / works / in / a bank',
    });

    expect(within(hardItem).getByText('Discrimina mal')).toBeInTheDocument();
  });
});

describe('Métricas — custos', () => {
  it('custo por ação e por plano, receita × custo e a margem', async () => {
    const user = userEvent.setup();

    await openMetrics();
    await user.click(screen.getByRole('tab', { name: 'Custos' }));

    expect(
      await screen.findByText('Câmbio fixo: US$ 1 = R$ 5,5'),
    ).toBeInTheDocument();
    const byFeature = screen.getByRole('table', {
      name: 'Custo de IA por ação',
    });

    expect(
      within(byFeature).getByText('Correção de escrita'),
    ).toBeInTheDocument();
    expect(
      within(byFeature).getByText('Rascunho de lição'),
    ).toBeInTheDocument();
    // Ação que o painel não conhece aparece como veio.
    expect(within(byFeature).getByText('feature-nova')).toBeInTheDocument();

    const byTier = screen.getByRole('table', { name: 'Custo de IA por plano' });

    expect(within(byTier).getByText('Sistema')).toBeInTheDocument();

    const revenue = screen.getByRole('table', {
      name: 'Receita e custo de IA por plano',
    });
    const plus = within(revenue).getByRole('row', { name: /Plus/ });

    // 5 assinantes e 5 ativos.
    expect(within(plus).getAllByText('5')).toHaveLength(2);
    expect(within(plus).getByText('R$ 349,50')).toBeInTheDocument();
  });

  it('os 20 alunos que mais consomem, com link para a ficha', async () => {
    const user = userEvent.setup();

    await openMetrics('/metricas?aba=custos');

    const table = await screen.findByRole('table', {
      name: 'Alunos que mais consomem IA',
    });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(20);

    const top = rows[0] as HTMLElement;

    expect(within(top).getByText('ana.lima@exemplo.com')).toBeInTheDocument();
    expect(within(top).getByText('US$ 0,0900')).toBeInTheDocument();
    expect(
      within(top).getByRole('link', {
        name: 'Abrir ficha: ana.lima@exemplo.com',
      }),
    ).toHaveAttribute('href', '/alunos/student-ana');

    // Conta anonimizada não mostra e-mail.
    expect(within(table).getByText('Conta excluída')).toBeInTheDocument();

    await user.click(within(top).getByRole('link', { name: /Abrir ficha/ }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/alunos/student-ana',
      ),
    );
  });
});

describe('Métricas — abas e erros', () => {
  it('a aba vive na URL', async () => {
    await openMetrics('/metricas?aba=conteudo');

    expect(screen.getByRole('tab', { name: 'Conteúdo' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      await screen.findByRole('table', { name: 'Lições com pior desempenho' }),
    ).toBeInTheDocument();
  });

  it('aba desconhecida cai em engajamento', async () => {
    await openMetrics('/metricas?aba=qualquer');

    expect(screen.getByRole('tab', { name: 'Engajamento' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('erro na leitura: mostra e tenta de novo', async () => {
    const user = userEvent.setup();

    failNext('metrics', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Sem permissão para ver as métricas.',
    });
    renderAdminAt('/metricas', { role: 'ADMIN' });

    expect(
      await screen.findByText('Sem permissão para ver as métricas.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await screen.findByRole('tab', { name: 'Engajamento' });
  });
});
