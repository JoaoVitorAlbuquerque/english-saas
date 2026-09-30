import { HttpResponse, http } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from '../../App';
import {
  plusCreditsFixture,
  resetGeneratorMockState,
} from '../../mocks/generator-handlers';
import { completedProfileFixture, sessionFixture } from '../../mocks/handlers';
import { server } from '../../mocks/server';

const API_URL = 'http://localhost:3333';

function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

function mockStudent({ plus }: { plus: boolean }) {
  server.use(
    http.post(`${API_URL}/auth/refresh`, () =>
      HttpResponse.json(sessionFixture),
    ),
    http.get(`${API_URL}/me/profile`, () =>
      HttpResponse.json(completedProfileFixture),
    ),
    ...(plus
      ? [
          http.get(`${API_URL}/me/credits`, () =>
            HttpResponse.json(plusCreditsFixture),
          ),
        ]
      : []),
  );
}

const NEWS_TEXT =
  'Humpback whales are back in the bay. Scientists counted more than two hundred whales this summer, the highest number in forty years. Local fishermen say the water is cleaner now, and tourists come every weekend to watch the whales jump.';

beforeEach(() => {
  resetGeneratorMockState();
  window.localStorage.clear();
});

describe('Ferramentas do Plus', () => {
  it('fluxo por tema: interesse → sugestões → escolhe → material completo', async () => {
    mockStudent({ plus: true });
    renderAppAt('/ferramentas');

    // Hub: saldo e custo de cada ação.
    expect(await screen.findByText('480 créditos')).toBeInTheDocument();
    expect(screen.getAllByText('5 créditos por material')).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('link', { name: 'Começar' })[0]!);

    // Atalho do perfil preenche o campo; sugerir não gasta crédito.
    await userEvent.click(
      await screen.findByRole('button', { name: 'História' }),
    );
    expect(screen.getByLabelText('Do que você gosta?')).toHaveValue('História');
    await userEvent.clear(screen.getByLabelText('Do que você gosta?'));
    await userEvent.type(
      screen.getByLabelText('Do que você gosta?'),
      'gosto de história, principalmente navegações',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver sugestões' }),
    );

    // Três assuntos reais, com o porquê, e o "surpreenda-me".
    expect(
      await screen.findByText("Magellan's voyage around the world"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Portugal e Espanha dividiram o mundo com uma linha no mapa.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Surpreenda-me' }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: "Quero esse: Magellan's voyage around the world",
      }),
    );

    // O job termina e o app abre o material.
    expect(
      await screen.findByRole('heading', { name: "Magellan's voyage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ferdinand Magellan' }),
    ).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Ferdinand_Magellan',
    );
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();

    // Destaque do texto mostra a explicação.
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Estrutura gramatical: Magellan left Spain',
      }),
    );
    expect(
      await screen.findByText('Passado irregular: leave → left.'),
    ).toBeInTheDocument();

    // Estrutura em foco, com exemplo do próprio texto.
    expect(screen.getByText('Past simple (irregular)')).toBeInTheDocument();

    // Como se fala: a fala alterna para a forma padrão.
    const spoken = screen
      .getByText('You gonna read about Magellan?')
      .closest('div')?.parentElement as HTMLElement;
    await userEvent.click(
      within(spoken).getByRole('button', { name: 'Estrutura gramatical' }),
    );
    expect(
      screen.getByText('Are you going to read about Magellan?'),
    ).toBeInTheDocument();

    // Vocabulário: um na revisão (com Remover), outro para adicionar.
    expect(screen.getByText('Na revisão ✓')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar à revisão: set sail' }),
    );
    expect(await screen.findAllByText('Na revisão ✓')).toHaveLength(2);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remover: caravel' }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Adicionar à revisão: caravel',
      }),
    ).toBeInTheDocument();

    // Exercício em modo prática: tocar responde e mostra o feedback.
    await userEvent.click(screen.getByRole('radio', { name: '1. left' }));
    expect(await screen.findByText('Isso mesmo.')).toBeInTheDocument();

    // Avaliação.
    await userEvent.click(screen.getByRole('button', { name: 'Gostei' }));
    expect(
      await screen.findByText(
        'Valeu — os próximos materiais levam isso em conta.',
      ),
    ).toBeInTheDocument();
  }, 15_000);

  it('fluxo por texto colado: limite visível, rede social pede transcrição, material sai', async () => {
    mockStudent({ plus: true });
    renderAppAt('/ferramentas/colar');

    const textarea = await screen.findByLabelText('Cole o texto em inglês');
    await userEvent.click(textarea);
    await userEvent.paste('Whales are back.');

    expect(screen.getByText(/Faltam 184 caracteres/)).toBeInTheDocument();
    expect(screen.getByText('16 / 40.000')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Montar material' }),
    ).toBeDisabled();

    // Link de YouTube: explica que precisa da legenda/transcrição.
    await userEvent.click(screen.getByRole('tab', { name: 'Link de artigo' }));
    await userEvent.type(
      screen.getByLabelText('Link do artigo'),
      'https://www.youtube.com/watch?v=abc',
    );
    expect(
      screen.getByText('Não baixamos vídeo nem post de rede social'),
    ).toBeInTheDocument();
    expect(screen.getByText(/links do YouTube/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Montar material' }),
    ).toBeDisabled();

    // Volta para o texto e cola um conteúdo de verdade.
    await userEvent.click(screen.getByRole('tab', { name: 'Texto' }));
    await userEvent.clear(screen.getByLabelText('Cole o texto em inglês'));
    await userEvent.click(screen.getByLabelText('Cole o texto em inglês'));
    await userEvent.paste(NEWS_TEXT);
    await userEvent.click(
      screen.getByRole('button', { name: 'Montar material' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Whales are back' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Baseado no texto que você mandou.'),
    ).toBeInTheDocument();
  }, 15_000);

  it('sem créditos: mostra saldo, custo e a data exata da renovação no fuso do aluno', async () => {
    mockStudent({ plus: true });
    server.use(
      http.post(`${API_URL}/generator/topic`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INSUFFICIENT_AI_CREDITS',
              message:
                'Seus créditos de IA deste mês acabaram. Eles voltam no próximo ciclo.',
              details: { feature: 'GENERATOR_TOPIC', cost: 5, balance: 2 },
            },
          },
          { status: 402 },
        ),
      ),
      http.get(`${API_URL}/me/credits`, () =>
        HttpResponse.json({ ...plusCreditsFixture, balance: 2 }),
      ),
    );
    renderAppAt('/ferramentas/tema');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Surpreenda-me' }),
    );

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText('Seus créditos não dão para isso agora'),
    ).toBeInTheDocument();
    // 00:05 UTC do dia 1º = 21:05 do dia 30 em São Paulo.
    expect(alert).toHaveTextContent(
      'Você tem 2 créditos e cada material custa 5. Seus créditos renovam em 30/09/2026, 21:05.',
    );
    expect(
      within(alert).getByRole('link', { name: 'Minha assinatura' }),
    ).toBeInTheDocument();
  });

  it('job que falhou mostra a mensagem do estorno e deixa tentar de novo', async () => {
    mockStudent({ plus: true });
    renderAppAt('/ferramentas/pedidos/job-failed');

    expect(
      await screen.findByText(
        'Não achamos uma fonte confiável sobre esse assunto. O crédito voltou — tenta outro tema.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Tentar de novo' }),
    ).toHaveAttribute('href', '/ferramentas/tema');
  });

  it('job em andamento mostra as fases e que dá para sair e voltar', async () => {
    mockStudent({ plus: true });
    renderAppAt('/ferramentas/pedidos/job-running');

    const phases = await screen.findByRole('list', {
      name: 'Montando seu material',
    });
    const items = within(phases).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Entendendo o tema — concluído',
      'Buscando a fonte — concluído',
      'Escrevendo no seu nível — em andamento',
      'Conferindo os fatos — a fazer',
    ]);
    expect(screen.getByText(/Pode sair desta tela/)).toBeInTheDocument();
    expect(window.localStorage.getItem('generator.pendingJobId')).toBe(
      'job-running',
    );
  });

  it('quem não é Plus vê o paywall com um exemplo de material', async () => {
    mockStudent({ plus: false });
    renderAppAt('/ferramentas');

    expect(
      await screen.findByText('Isso faz parte do plano Plus'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Magellan and the first trip around the world'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Conhecer o Plus' }),
    ).toHaveAttribute('href', '/planos');
  });

  it('meus materiais: lista com tema, nível e data, e a evolução do nível', async () => {
    mockStudent({ plus: true });
    renderAppAt('/materiais');

    expect(
      await screen.findByText('Você subiu 1 nível desde o primeiro material.'),
    ).toBeInTheDocument();
    expect(screen.getByText("Magellan's voyage")).toBeInTheDocument();
    expect(screen.getByText(/história · 20\/09\/2026/)).toBeInTheDocument();
  });
});
