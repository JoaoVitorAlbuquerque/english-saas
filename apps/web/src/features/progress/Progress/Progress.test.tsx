import { HttpResponse, http } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../App';
import {
  completedProfileFixture,
  sessionFixture,
} from '../../../mocks/handlers';
import {
  newStudentProgressFixture,
  progressFixture,
  progressRequestedWeeks,
  resetProgressMockState,
} from '../../../mocks/progress-handlers';
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

/** A figura só existe depois que o painel chega — espera, e já devolve o escopo. */
async function figure(name: string) {
  return within(await screen.findByRole('figure', { name }));
}

beforeEach(() => {
  resetProgressMockState();
});

describe('Progresso', () => {
  it('mostra o nível geral e as barras por habilidade, com confiança baixa listrada', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/progresso');

    expect(
      await screen.findByText('A2 · Básico', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Calculado a partir das suas respostas.'),
    ).toBeInTheDocument();

    const levels = await figure('Nível por habilidade');
    for (const name of [
      'Gramática',
      'Vocabulário',
      'Escuta',
      'Leitura',
      'Escrita',
      'Fala',
    ]) {
      // O nome também está na tabela alternativa, por isso "getAll".
      expect(levels.getAllByText(name).length).toBeGreaterThan(0);
    }
    // Estimativa frágil vem escrita ("Poucos dados"), além de listrada.
    expect(levels.getAllByText('Poucos dados')).toHaveLength(2);
    expect(levels.getByText('Estimativa firme')).toBeInTheDocument();
    expect(levels.getByText('Poucos dados — pode mudar')).toBeInTheDocument();
    // Sem evidência nenhuma: texto, não barra zerada.
    expect(levels.getAllByText('Sem dados ainda').length).toBeGreaterThan(0);
  });

  it('mostra a evolução com a meta e a previsão de chegada', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/progresso');

    const evolution = await figure('Evolução do nível');
    expect(await evolution.findByText('Meta: B1')).toBeInTheDocument();

    expect(screen.getByText('Previsão de chegada')).toBeInTheDocument();
    expect(screen.getByText('Atrás do previsto')).toBeInTheDocument();
    expect(
      screen.getByText(/6 semanas depois do previsto/),
    ).toBeInTheDocument();
    expect(screen.getByText('Seu objetivo: nível B1')).toBeInTheDocument();
    expect(screen.getByText('Pelo cronograma: 01/03/2027')).toBeInTheDocument();
    expect(screen.getByText('Pelo seu ritmo: 12/04/2027')).toBeInTheDocument();
  });

  it('trocar a competência da evolução muda a linha', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/progresso');

    const evolution = await figure('Evolução do nível');
    await userEvent.click(evolution.getByText('Ver como tabela'));
    const table = evolution.getByRole('table');
    expect(within(table).getAllByText('A2').length).toBeGreaterThan(0);
    expect(within(table).queryByText('B1')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Gramática' }));

    expect(
      within(
        (await figure('Evolução do nível')).getByRole('table'),
      ).getAllByText('B1').length,
    ).toBeGreaterThan(0);
  });

  it('cada ponto fraco tem uma ação, e o botão leva para o lugar certo', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/progresso');

    expect(
      await screen.findByText('Você já domina: Se apresentar.'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: 'Ver lição: Passado simples' }),
    ).toHaveAttribute('href', '/licoes/yesterday');
    expect(
      screen.getByRole('link', { name: 'Praticar agora: Artigos' }),
    ).toHaveAttribute('href', '/revisao');
    expect(
      screen.getByRole('link', { name: 'Gerar material sobre isso: Viagem' }),
    ).toHaveAttribute('href', '/ferramentas/tema');
    expect(
      screen.getByRole('link', { name: 'Praticar agora: Perguntas' }),
    ).toHaveAttribute('href', '/hoje');
  });

  it('quem não é Plus não recebe "Gerar material" (a API não sugere)', async () => {
    mockAuthenticatedStudent();
    server.use(
      http.get(`${API_URL}/me/progress`, () =>
        HttpResponse.json({
          ...progressFixture,
          weaknesses: progressFixture.weaknesses.filter(
            (weakness) => weakness.action.type !== 'MATERIAL',
          ),
        }),
      ),
    );
    renderAppAt('/progresso');

    await screen.findByText('Você já domina: Se apresentar.');

    expect(
      screen.queryByRole('link', { name: /Gerar material sobre isso/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver lição: Passado simples' }),
    ).toBeInTheDocument();
  });

  it('erros: descrição, correção, contagem, tendência e as frases reais do aluno', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/progresso');

    expect(
      await screen.findByText(/Dizer "I have 20 years"/),
    ).toBeInTheDocument();
    expect(screen.getByText('Está diminuindo')).toBeInTheDocument();
    expect(screen.getByText('Ainda poucos dados')).toBeInTheDocument();
    expect(
      screen.getByText('Apareceu 3 de 12 vezes recentes'),
    ).toBeInTheDocument();
    expect(screen.getByText('I am 20 years old')).toBeInTheDocument();

    // Frases vindas do perfil do modelo, de erro recorrente e de observado.
    expect(await screen.findByText(/“I have 22 years”/)).toBeInTheDocument();
    expect(screen.getByText(/“She have 20 years”/)).toBeInTheDocument();
    expect(screen.getByText(/“I live in the Brazil”/)).toBeInTheDocument();
  });

  it('se o perfil do modelo falhar, os erros continuam, só sem as frases', async () => {
    mockAuthenticatedStudent();
    server.use(
      http.get(`${API_URL}/me/learner-profile`, () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Não encontramos.' } },
          { status: 404 },
        ),
      ),
    );
    renderAppAt('/progresso');

    expect(
      await screen.findByText(/Dizer "I have 20 years"/),
    ).toBeInTheDocument();
    expect(screen.getByText('Está diminuindo')).toBeInTheDocument();
    expect(screen.queryByText(/“I have 22 years”/)).not.toBeInTheDocument();
    expect(screen.queryByText('O que você escreveu:')).not.toBeInTheDocument();
  });

  it('cumprimento do plano: planejado × feito por semana e os números do período', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/progresso');

    const plan = await figure('Cumprimento do plano');
    // O rótulo da semana também está na tabela alternativa, por isso "getAll".
    expect(plan.getAllByText('28/09').length).toBeGreaterThan(0);
    // A legenda diz o que é cada barra, com amostra de cor e de padrão.
    const legend = within(plan.getByRole('list'));
    expect(legend.getByText('Planejado')).toBeInTheDocument();
    expect(legend.getByText('Feito')).toBeInTheDocument();
    // A semana mais cheia: 135 min feitos de 120 planejados, escrito na barra.
    expect(plan.getByText('135')).toBeInTheDocument();

    const numbers = {
      'Minutos estudados': '340 min',
      'Lições concluídas': '6',
      'Revisões feitas': '48',
      'Sequência atual': '3 dias',
      'Maior sequência': '9 dias',
    };
    for (const [label, value] of Object.entries(numbers)) {
      const term = screen.getByText(label, { selector: 'dt' });
      expect(term.nextElementSibling).toHaveTextContent(value);
    }
  });

  it('trocar o período refaz a consulta com as semanas escolhidas', async () => {
    mockAuthenticatedStudent();
    renderAppAt('/progresso');

    await screen.findByText('Previsão de chegada');
    expect(progressRequestedWeeks).toEqual([8]);
    expect(screen.getByRole('button', { name: '8 semanas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: '12 semanas' }));

    await vi.waitFor(() => {
      expect(progressRequestedWeeks).toEqual([8, 12]);
    });
    expect(
      await screen.findByRole('button', { name: '12 semanas' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('aluno novo vê o convite, não gráficos vazios', async () => {
    mockAuthenticatedStudent();
    server.use(
      http.get(`${API_URL}/me/progress`, () =>
        HttpResponse.json(newStudentProgressFixture),
      ),
    );
    renderAppAt('/progresso');

    expect(
      await screen.findByText('Seu progresso começa na primeira lição'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Fazer o nivelamento' }),
    ).toHaveAttribute('href', '/nivelamento');
    expect(
      screen.getByRole('link', { name: 'Ver a agenda de hoje' }),
    ).toHaveAttribute('href', '/hoje');
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '8 semanas' }),
    ).not.toBeInTheDocument();
  });

  it('falha ao carregar mostra o erro com "tentar de novo"', async () => {
    mockAuthenticatedStudent();
    server.use(
      http.get(`${API_URL}/me/progress`, () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Não encontramos.' } },
          { status: 404 },
        ),
      ),
    );
    renderAppAt('/progresso');

    expect(
      await screen.findByText('Não conseguimos carregar seu progresso'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Tentar de novo/i }),
    ).toBeInTheDocument();
  });
});
