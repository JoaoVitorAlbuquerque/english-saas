import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockState } from '../../../../mocks/curriculum-mock';
import { server } from '../../../../mocks/server';
import { API_URL, renderAdminAt } from '../../test-helpers';

/** A versão publicada tem uma etapa de cada tipo. */
const FULL = 'version-1-2';
const DRAFT = 'version-2-1';

async function openPreview(versionId = FULL, heading = 'Versão 2') {
  renderAdminAt(`/conteudo/versoes/${versionId}`);
  await screen.findByRole('heading', { name: heading });
  await screen.findByRole('navigation', { name: 'Etapas do preview' });
}

const nav = () =>
  within(screen.getByRole('navigation', { name: 'Etapas do preview' }));
const frame = () => within(screen.getByTestId('preview-frame'));

async function goTo(name: RegExp) {
  await userEvent.click(nav().getByRole('button', { name }));
}

describe('Preview da lição', () => {
  describe('tamanho da tela', () => {
    it('começa no tamanho de celular e alterna para desktop', async () => {
      await openPreview();

      const quadro = screen.getByTestId('preview-frame');

      expect(quadro).toHaveAttribute('data-device', 'phone');
      expect(quadro.className).toContain('w-[390px]');
      expect(screen.getByRole('button', { name: 'Celular' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Desktop' }));

      expect(quadro).toHaveAttribute('data-device', 'desktop');
      expect(quadro.className).toContain('w-full');
      expect(quadro.className).not.toContain('w-[390px]');
      expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('dá para esconder e mostrar o painel', async () => {
      await openPreview();

      await userEvent.click(
        screen.getByRole('button', { name: 'Esconder o painel' }),
      );

      expect(screen.queryByTestId('preview-frame')).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'Mostrar o painel' }),
      );

      expect(await screen.findByTestId('preview-frame')).toBeInTheDocument();
    });
  });

  describe('as etapas como o aluno vê', () => {
    it('cena: local, elenco, tradução sob demanda e alternância falado × gramatical', async () => {
      await openPreview();

      expect(
        frame().getByText('Corredor do prédio, em Austin'),
      ).toBeInTheDocument();
      expect(frame().getAllByText('Maya').length).toBeGreaterThan(0);
      expect(frame().queryByText('Sim, eu vou morar no 4B.')).toBeNull();

      await userEvent.click(
        frame().getAllByRole('button', {
          name: 'Ver tradução',
        })[1] as HTMLElement,
      );

      expect(frame().getByText('Sim, eu vou morar no 4B.')).toBeInTheDocument();

      // A fala 2 tem forma padrão: o aluno alterna.
      await userEvent.click(
        frame().getByRole('button', { name: 'Estrutura gramatical' }),
      );

      expect(
        frame().getByText("Yes, I'm going to live in 4B."),
      ).toBeInTheDocument();
    });

    it('a etapa seguinte abre pelo "Continuar" da própria etapa', async () => {
      await openPreview();

      await userEvent.click(frame().getByRole('button', { name: 'Continuar' }));

      expect(
        frame().getByRole('heading', { name: 'Verbo to be' }),
      ).toBeInTheDocument();
      expect(
        nav().getByRole('button', { name: /^2\. Explicação/ }),
      ).toHaveAttribute('aria-current', 'step');
    });

    it('cards: texto em markdown e exemplo', async () => {
      await openPreview();
      await goTo(/^2\. Explicação/);

      expect(
        frame().getByText('pessoa', { selector: 'strong' }),
      ).toBeInTheDocument();
      expect(frame().getByText('Eu sou a Maya.')).toBeInTheDocument();
    });

    it('produção livre: o estado de entrada, com o envio desligado e o aviso de que a IA não roda', async () => {
      await openPreview();
      await goTo(/^4\. Produção livre/);

      expect(
        frame().getByText('Apresente-se em duas frases.'),
      ).toBeInTheDocument();
      expect(
        frame().getByRole('button', { name: 'Nice to meet you' }),
      ).toBeInTheDocument();

      await userEvent.type(frame().getByLabelText('Sua resposta'), 'Hi');

      expect(frame().getByRole('button', { name: 'Enviar' })).toBeDisabled();
      expect(
        frame().getByText(/a correção por IA não roda aqui/),
      ).toBeInTheDocument();
    });

    it('conversa: cenário, metas e a abertura do personagem, sem IA', async () => {
      await openPreview();
      await goTo(/^5\. Conversa/);

      expect(
        frame().getByText('No elevador do prédio, você encontra a vizinha.'),
      ).toBeInTheDocument();
      expect(frame().getByText('Dizer o próprio nome')).toBeInTheDocument();
      expect(frame().getByText('Hi! Are you new here?')).toBeInTheDocument();
      expect(frame().getByLabelText('Escreva sua resposta')).toBeDisabled();
      expect(
        frame().getByText(/a conversa com a IA não roda aqui/),
      ).toBeInTheDocument();
    });

    it('resumo: o que o aluno leva, sem concluir a lição', async () => {
      await openPreview();
      await goTo(/^6\. Resumo/);

      expect(frame().getByText("I am / I'm")).toBeInTheDocument();
      expect(
        frame().getByRole('button', { name: 'Concluir lição' }),
      ).toBeDisabled();
    });
  });

  describe('prática', () => {
    it('a questão é respondível, mas não é corrigida: nada vai ao servidor', async () => {
      await openPreview(DRAFT, 'Versão 1');
      await goTo(/^2\. Prática/);

      expect(frame().getByText('Questão 1 de 2')).toBeInTheDocument();
      expect(frame().getByText('I ___ Maya.')).toBeInTheDocument();

      // Se o preview mandasse a resposta, o MSW recusaria (`onUnhandledRequest`).
      await userEvent.click(frame().getByRole('radio', { name: /am/ }));

      expect(
        frame().getByText(/a resposta não é corrigida aqui/),
      ).toBeInTheDocument();
      expect(frame().queryByText('Certo')).not.toBeInTheDocument();
    });

    it('"Ver gabarito" mostra a resposta certa e a explicação, e dá para esconder', async () => {
      await openPreview(DRAFT, 'Versão 1');
      await goTo(/^2\. Prática/);

      await userEvent.click(
        frame().getByRole('button', { name: 'Ver gabarito' }),
      );

      expect(
        await frame().findByText('Com "I", o verbo é "am".'),
      ).toBeInTheDocument();

      await userEvent.click(
        frame().getByRole('button', { name: 'Esconder o gabarito' }),
      );

      expect(
        frame().queryByText('Com "I", o verbo é "am".'),
      ).not.toBeInTheDocument();
    });

    it('navega entre as questões; a última leva à etapa seguinte', async () => {
      await openPreview(DRAFT, 'Versão 1');
      await goTo(/^2\. Prática/);

      await userEvent.click(
        frame().getByRole('button', { name: 'Próxima questão' }),
      );

      expect(frame().getByText('Questão 2 de 2')).toBeInTheDocument();
      expect(frame().getByText('She ___ from Austin.')).toBeInTheDocument();

      await userEvent.click(frame().getByRole('button', { name: 'Continuar' }));

      expect(frame().getByText('O que você aprendeu')).toBeInTheDocument();
    });

    it('o preview nunca recebe o gabarito: ele só vem do banco, para o editor', async () => {
      await openPreview(DRAFT, 'Versão 1');
      await goTo(/^2\. Prática/);

      const response = await fetch(
        `${API_URL}/admin/curriculum/lesson-versions/${DRAFT}/preview`,
      );
      const body = await response.json();

      expect(JSON.stringify(body.items)).not.toContain('correctOptionIds');
    });
  });

  describe('rascunho pela metade', () => {
    it('etapa inválida vira um aviso naquela etapa, e as outras seguem', async () => {
      await openPreview(DRAFT, 'Versão 1');

      await userEvent.click(
        screen.getByRole('button', { name: 'Adicionar etapa: Prática' }),
      );

      // O preview acompanha o salvamento.
      await waitFor(
        () =>
          expect(
            nav().getByRole('button', { name: /^4\. Prática/ }),
          ).toBeInTheDocument(),
        { timeout: 6000 },
      );

      await goTo(/^4\. Prática/);

      expect(
        frame().getByText('Esta etapa ainda tem erros'),
      ).toBeInTheDocument();
      expect(
        frame().getByText(/questões: Adicione ao menos um item/),
      ).toBeInTheDocument();

      await goTo(/^1\. Cena/);

      expect(
        frame().getByText('Corredor do prédio, em Austin'),
      ).toBeInTheDocument();
    });

    it('o preview se refaz a cada salvamento', async () => {
      await openPreview(DRAFT, 'Versão 1');

      const before = mockState.calls.previews.length;

      await userEvent.type(
        within(
          document.getElementById('editor-panel') as HTMLElement,
        ).getByLabelText('Onde a cena acontece'),
        ' (manhã)',
      );

      await waitFor(
        () => expect(mockState.calls.previews.length).toBeGreaterThan(before),
        { timeout: 6000 },
      );
      expect(
        await frame().findByText('Corredor do prédio, em Austin (manhã)'),
      ).toBeInTheDocument();
    });
  });

  it('erro ao carregar mostra a mensagem e deixa tentar de novo', async () => {
    let calls = 0;

    server.use(
      http.get(
        `${API_URL}/admin/curriculum/lesson-versions/${FULL}/preview`,
        () => {
          calls += 1;

          return HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Sem preview.' } },
            { status: 404 },
          );
        },
      ),
    );

    renderAdminAt(`/conteudo/versoes/${FULL}`);
    await screen.findByRole('heading', { name: 'Versão 2' });

    expect(
      await screen.findByText('Não conseguimos carregar o preview.'),
    ).toBeInTheDocument();
    expect(calls).toBeGreaterThan(0);
    expect(screen.getByText('Sem preview.')).toBeInTheDocument();
  });
});
