import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  ITEM_AM_ID,
  ITEM_TYPE_ID,
  failNext,
  mockState,
} from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openBank() {
  renderAdminAt('/conteudo/questoes');
  await screen.findByRole('heading', { name: 'Banco de questões' });
  await screen.findByRole('table', { name: 'Questões do banco' });
}

const table = () =>
  within(screen.getByRole('table', { name: 'Questões do banco' }));
const prompts = () =>
  table()
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
const queries = (resource: string) =>
  mockState.calls.listQueries
    .filter((query) => query.resource === resource)
    .map((query) => query.search);

describe('Banco de questões → lista', () => {
  it('lista as questões da mais nova para a mais antiga, com tipo, nível, status e origem escritos', async () => {
    await openBank();

    expect(prompts().slice(0, 3)).toEqual([
      'Passe para a forma padrão.',
      'Onde o Lucas mora?',
      'Escreva o que ouvir.',
    ]);

    const row = table().getByRole('row', { name: /Monte a frase\./ });

    expect(within(row).getByText('Ordenar as palavras')).toBeInTheDocument();
    expect(within(row).getByText('Rascunho')).toBeInTheDocument();
    expect(within(row).getByText('Rascunho de IA')).toBeInTheDocument();
    expect(within(row).getByText('A1')).toBeInTheDocument();
  });

  it('mostra exposição, % de acerto e dificuldade', async () => {
    await openBank();

    const row = table().getByRole('row', { name: /Traduza: Ela é de Austin/ });

    expect(within(row).getByText('80')).toBeInTheDocument();
    expect(within(row).getByText('7%')).toBeInTheDocument();
    expect(within(row).getByText('+0,90')).toBeInTheDocument();
    // Sem dados suficientes, o acerto é um traço — não zero.
    const fresh = table().getByRole('row', { name: /Monte a frase\./ });

    expect(
      within(fresh).getByText('—', { selector: 'td' }),
    ).toBeInTheDocument();
  });

  it('o item problemático leva a marca escrita ao lado', async () => {
    await openBank();

    const hard = table().getByRole('row', { name: /Traduza: Ela é de Austin/ });
    const easy = table().getByRole('row', { name: /I ___ Maya\./ });

    expect(
      await within(hard).findByText('Difícil demais (menos de 10% acertam)'),
    ).toBeInTheDocument();
    expect(within(hard).getByText('Discrimina mal')).toBeInTheDocument();
    expect(
      within(easy).getByText('Fácil demais (mais de 95% acertam)'),
    ).toBeInTheDocument();
  });

  it('cada enunciado leva ao editor da questão', async () => {
    await openBank();

    expect(table().getByRole('link', { name: 'I ___ Maya.' })).toHaveAttribute(
      'href',
      `/conteudo/questoes/${ITEM_AM_ID}`,
    );
    expect(screen.getByRole('link', { name: 'Nova questão' })).toHaveAttribute(
      'href',
      '/conteudo/questoes/nova',
    );
  });

  describe('filtros', () => {
    it('tipo, nível, status e origem vão para a API', async () => {
      await openBank();

      await userEvent.selectOptions(
        screen.getByLabelText('Tipo de questão'),
        'TYPE_ANSWER',
      );

      await waitFor(() =>
        expect(prompts()).toEqual(['Traduza: Ela é de Austin']),
      );
      expect(queries('items').at(-1)).toContain('type=TYPE_ANSWER');

      await userEvent.selectOptions(
        screen.getByLabelText('Tipo de questão'),
        '',
      );
      await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A2');

      await waitFor(() =>
        expect(prompts().sort()).toEqual(
          [
            'Passe para a forma padrão.',
            'Onde o Lucas mora?',
            'Ligue as palavras.',
          ].sort(),
        ),
      );

      await userEvent.selectOptions(screen.getByLabelText('Status'), 'DRAFT');

      await waitFor(() =>
        expect(prompts()).toEqual(['Passe para a forma padrão.']),
      );
      expect(queries('items').at(-1)).toContain('status=DRAFT');
      expect(queries('items').at(-1)).toContain('level=A2');

      await userEvent.selectOptions(screen.getByLabelText('Nível'), '');
      await userEvent.selectOptions(screen.getByLabelText('Status'), '');
      await userEvent.selectOptions(
        screen.getByLabelText('Origem'),
        'AI_DRAFT',
      );

      await waitFor(() => expect(prompts()).toEqual(['Monte a frase.']));
      expect(queries('items').at(-1)).toContain('source=AI_DRAFT');
    });

    it('busca por texto no enunciado', async () => {
      await openBank();

      await userEvent.type(screen.getByLabelText('Buscar'), 'lucas');

      await waitFor(() => expect(prompts()).toEqual(['Onde o Lucas mora?']));
      expect(queries('items').at(-1)).toContain('q=lucas');
    });

    it('por skill', async () => {
      await openBank();

      await userEvent.type(
        screen.getByLabelText(/Buscar skill/),
        'Verbo to be',
      );
      await userEvent.click(
        await screen.findByRole('button', { name: /Verbo to be no presente/ }),
      );

      await waitFor(() =>
        expect(queries('items').at(-1)).toContain(
          'skillId=grammar.be.present.affirmative',
        ),
      );
    });

    it('sem resultado, o aviso oferece limpar os filtros', async () => {
      await openBank();

      await userEvent.type(screen.getByLabelText('Buscar'), 'zzz');

      expect(
        await screen.findByText('Nenhuma questão por aqui'),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'Limpar filtros' }),
      );

      expect(
        await screen.findByRole('table', { name: 'Questões do banco' }),
      ).toBeInTheDocument();
    });
  });

  describe('problemáticos', () => {
    it('troca para a fila da calibração: só os marcados, um por linha', async () => {
      await openBank();

      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Só os problemáticos' }),
      );

      await waitFor(() => expect(prompts()).toHaveLength(2));
      expect(prompts().sort()).toEqual(
        ['I ___ Maya.', 'Traduza: Ela é de Austin'].sort(),
      );
      // Uma linha por item, mesmo com duas rodadas marcadas no item difícil.
      expect(
        queries('flagged').some((search) => search.includes('limit=30')),
      ).toBe(true);
      expect(
        screen.getByText(
          /A fila de problemáticos .* filtra por marca, nível e tipo/,
        ),
      ).toBeInTheDocument();
      // Os filtros que a fila não tem ficam desligados.
      expect(screen.getByLabelText('Status')).toBeDisabled();
      expect(screen.getByLabelText('Origem')).toBeDisabled();
      expect(screen.getByLabelText('Buscar')).toBeDisabled();
    });

    it('filtra a fila por marca, nível e tipo', async () => {
      await openBank();
      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Só os problemáticos' }),
      );
      await waitFor(() => expect(prompts()).toHaveLength(2));

      await userEvent.selectOptions(screen.getByLabelText('Marca'), 'TOO_HARD');

      await waitFor(() =>
        expect(prompts()).toEqual(['Traduza: Ela é de Austin']),
      );
      expect(queries('flagged').at(-1)).toContain('flag=TOO_HARD');

      await userEvent.selectOptions(screen.getByLabelText('Marca'), '');
      await userEvent.selectOptions(
        screen.getByLabelText('Tipo de questão'),
        'MULTIPLE_CHOICE',
      );

      await waitFor(() => expect(prompts()).toEqual(['I ___ Maya.']));
      expect(queries('flagged').at(-1)).toContain('type=MULTIPLE_CHOICE');
    });

    it('depois de resolver, o item sai da fila', async () => {
      for (const row of mockState.calibrations) {
        if (row.itemId === ITEM_TYPE_ID) {
          row.resolvedAt = '2026-10-20T12:00:00.000Z';
        }
      }

      await openBank();
      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Só os problemáticos' }),
      );

      await waitFor(() => expect(prompts()).toEqual(['I ___ Maya.']));
    });

    it('fila vazia diz que não há problemáticos', async () => {
      mockState.calibrations.length = 0;

      await openBank();
      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Só os problemáticos' }),
      );

      expect(
        await screen.findByText('Nenhum item problemático'),
      ).toBeInTheDocument();
    });
  });

  it('"Carregar mais" traz a próxima página', async () => {
    for (let n = 0; n < 35; n += 1) {
      mockState.items.push({
        id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
        slug: null,
        type: 'TYPE_ANSWER',
        prompt: `Extra ${String(n)}`,
        content: {},
        acceptedAnswers: ['x'],
        explanation: 'Explicação.',
        errorPatternMap: {},
        cefrLevel: 'B1',
        difficulty: 0,
        discrimination: 1,
        exposureCount: 0,
        correctRate: null,
        status: 'DRAFT',
        source: 'HUMAN',
        replacedById: null,
        replaces: null,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
        skillIds: ['grammar.be.present.affirmative'],
      });
    }

    await openBank();

    expect(prompts()).toHaveLength(30);

    await userEvent.click(
      screen.getByRole('button', { name: 'Carregar mais' }),
    );

    await waitFor(() => expect(prompts()).toHaveLength(44));
    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
    ).not.toBeInTheDocument();
  });

  it('erro ao carregar deixa tentar de novo', async () => {
    // Erro 4xx não é repetido sozinho pelo cliente: a tela mostra de uma vez.
    failNext('items-list', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Você não tem acesso a isto.',
    });

    renderAdminAt('/conteudo/questoes');

    expect(
      await screen.findByText('Não conseguimos carregar esta tela.'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );

    expect(
      await screen.findByRole('table', { name: 'Questões do banco' }),
    ).toBeInTheDocument();
  });
});
