import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  failNext,
  mockState,
  type MockVersion,
} from '../../../mocks/curriculum-mock';
import { server } from '../../../mocks/server';
import { API_URL, renderAdminAt } from '../test-helpers';

async function openTree() {
  renderAdminAt('/conteudo');
  await screen.findByRole('heading', { name: 'Conteúdo' });
  await screen.findByText('New neighbors');
}

describe('Conteúdo → árvore do curso', () => {
  it('mostra nível, unidades e lições com o estado e a versão publicada', async () => {
    await openTree();

    expect(
      screen.getByRole('heading', { name: /Nível A1/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Nível A2/ }),
    ).toBeInTheDocument();

    const unit = screen.getByText('New neighbors').closest('li') as HTMLElement;

    // Selo da unidade e selo da lição publicada.
    expect(within(unit).getAllByText('Publicado')).toHaveLength(2);

    const nice = within(unit)
      .getByRole('link', { name: 'Abrir Nice to meet you' })
      .closest('li') as HTMLElement;

    expect(within(nice).getByText('v2 publicada')).toBeInTheDocument();
    expect(within(nice).getByText('Publicado')).toBeInTheDocument();

    const cafe = within(unit)
      .getByRole('link', { name: 'Abrir At the café' })
      .closest('li') as HTMLElement;

    expect(within(cafe).getByText('Rascunho')).toBeInTheDocument();
    expect(within(cafe).getByText('Sem versão publicada')).toBeInTheDocument();
  });

  it('lição com versão nova aberta mostra o estado dela e a versão no ar', async () => {
    mockState.versions.push({
      ...structuredClone(
        mockState.versions.find((v) => v.id === 'version-1-2') as MockVersion,
      ),
      id: 'version-1-3',
      version: 3,
      status: 'IN_REVIEW',
      publishedAt: null,
    });

    await openTree();

    const nice = screen
      .getByRole('link', { name: 'Abrir Nice to meet you' })
      .closest('li') as HTMLElement;

    expect(within(nice).getByText('Em revisão')).toBeInTheDocument();
    expect(within(nice).getByText('v2 publicada')).toBeInTheDocument();
    expect(within(nice).getByText('Última versão: v3')).toBeInTheDocument();
  });

  it('nível sem unidade explica que está vazio', async () => {
    await openTree();

    expect(
      screen.getByText('Nenhuma unidade neste nível ainda.'),
    ).toBeInTheDocument();
  });

  describe('criar', () => {
    it('unidade: o slug acompanha o título, e a unidade nasce em rascunho no fim do nível', async () => {
      await openTree();

      const a2 = screen
        .getByRole('heading', { name: /Nível A2/ })
        .closest('section') as HTMLElement;

      await userEvent.click(
        within(a2).getByRole('button', { name: 'Nova unidade' }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(
        within(dialog).getByLabelText('Título'),
        'Weekend plans',
      );

      expect(within(dialog).getByLabelText(/Identificador/)).toHaveValue(
        'weekend-plans',
      );

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Criar' }),
      );

      expect(await screen.findByText('Weekend plans')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const created = mockState.units.find((u) => u.slug === 'weekend-plans');

      expect(created).toMatchObject({
        levelId: 'level-a2',
        order: 0,
        status: 'DRAFT',
      });
    });

    it('unidade: slug repetido aparece no campo e nada é criado', async () => {
      await openTree();

      const a1 = screen
        .getByRole('heading', { name: /Nível A1/ })
        .closest('section') as HTMLElement;

      await userEvent.click(
        within(a1).getByRole('button', { name: 'Nova unidade' }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(within(dialog).getByLabelText('Título'), 'Outra');
      await userEvent.clear(within(dialog).getByLabelText(/Identificador/));
      await userEvent.type(
        within(dialog).getByLabelText(/Identificador/),
        'a1-u1-new-neighbors',
      );
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Criar' }),
      );

      expect(
        await within(dialog).findByText(
          /Já existe conteúdo com o identificador/,
        ),
      ).toBeInTheDocument();
      expect(mockState.units).toHaveLength(2);
    });

    it('unidade: slug fora do padrão e título curto são barrados antes de chamar a API', async () => {
      await openTree();

      await userEvent.click(
        within(
          screen
            .getByRole('heading', { name: /Nível A2/ })
            .closest('section') as HTMLElement,
        ).getByRole('button', { name: 'Nova unidade' }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(within(dialog).getByLabelText('Título'), 'A');
      await userEvent.clear(within(dialog).getByLabelText(/Identificador/));
      await userEvent.type(
        within(dialog).getByLabelText(/Identificador/),
        'Slug Inválido!',
      );
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Criar' }),
      );

      expect(
        within(dialog).getByText('Escreva ao menos 2 caracteres.'),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(/Use minúsculas, números e hífen/),
      ).toBeInTheDocument();
      expect(mockState.units).toHaveLength(2);
    });

    it('lição: cria com a versão 1 em rascunho e já abre o editor', async () => {
      await openTree();

      const unit = screen
        .getByText('New neighbors')
        .closest('li') as HTMLElement;

      await userEvent.click(
        within(unit).getByRole('button', { name: 'Nova lição' }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(
        within(dialog).getByLabelText('Título'),
        'Ordering food',
      );
      await userEvent.type(
        within(dialog).getByLabelText(/Objetivo/),
        'Pedir comida num restaurante.',
      );
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Criar' }),
      );

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          /^\/conteudo\/versoes\//,
        ),
      );

      const lesson = mockState.lessons.find((l) => l.slug === 'ordering-food');

      expect(lesson).toMatchObject({ unitId: 'unit-1', order: 2 });
      expect(
        mockState.versions.find((v) => v.lessonId === lesson?.id),
      ).toMatchObject({ version: 1, status: 'DRAFT', cefrLevel: 'A1' });
    });

    it('lição: objetivo curto demais é barrado no campo', async () => {
      await openTree();

      await userEvent.click(
        within(
          screen.getByText('New neighbors').closest('li') as HTMLElement,
        ).getByRole('button', { name: 'Nova lição' }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(within(dialog).getByLabelText('Título'), 'Ordering');
      await userEvent.type(within(dialog).getByLabelText(/Objetivo/), 'abc');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Criar' }),
      );

      expect(
        within(dialog).getByText('Escreva ao menos 4 caracteres.'),
      ).toBeInTheDocument();
      expect(mockState.lessons).toHaveLength(2);
    });
  });

  describe('reordenar', () => {
    it('unidades: manda o nível e a lista inteira na ordem nova', async () => {
      await openTree();

      await userEvent.click(
        screen.getByRole('button', { name: 'Descer a unidade New neighbors' }),
      );

      await waitFor(() =>
        expect(mockState.calls.reorderUnits).toEqual([
          { levelId: 'level-a1', ids: ['unit-2', 'unit-1'] },
        ]),
      );

      // A tela já reflete a ordem nova.
      await waitFor(() => {
        const titles = screen
          .getAllByRole('heading', { level: 3 })
          .map((heading) => heading.textContent);

        expect(titles.indexOf('First day')).toBeLessThan(
          titles.indexOf('New neighbors'),
        );
      });
    });

    it('lições: manda a unidade e a lista inteira na ordem nova', async () => {
      await openTree();

      await userEvent.click(
        screen.getByRole('button', { name: 'Subir a lição At the café' }),
      );

      await waitFor(() =>
        expect(mockState.calls.reorderLessons).toEqual([
          { unitId: 'unit-1', ids: ['lesson-2', 'lesson-1'] },
        ]),
      );
    });

    it('as pontas não sobem nem descem', async () => {
      await openTree();

      expect(
        screen.getByRole('button', { name: 'Subir a unidade New neighbors' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Descer a unidade First day' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Descer a lição At the café' }),
      ).toBeDisabled();
    });

    it('se a API recusar, a lista volta como estava e avisa', async () => {
      await openTree();
      failNext('reorder-lessons', {
        status: 422,
        code: 'REORDER_MISMATCH',
        message: 'A lista não bate.',
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Subir a lição At the café' }),
      );

      expect(
        await screen.findByText(
          'Não conseguimos reordenar. A lista voltou como estava.',
        ),
      ).toBeInTheDocument();

      await waitFor(() => {
        const links = screen
          .getAllByRole('link', { name: /^Abrir / })
          .map((link) => link.getAttribute('aria-label'));

        expect(links).toEqual(['Abrir Nice to meet you', 'Abrir At the café']);
      });
    });
  });

  describe('unidade: fluxo editorial', () => {
    it('envia para revisão direto', async () => {
      await openTree();

      const unit = screen.getByText('First day').closest('li') as HTMLElement;

      await userEvent.click(
        within(unit).getByRole('button', { name: 'Enviar para revisão' }),
      );

      await waitFor(() =>
        expect(mockState.calls.unitTransitions).toEqual([
          { id: 'unit-2', action: 'submit' },
        ]),
      );
      expect(await within(unit).findByText('Em revisão')).toBeInTheDocument();
    });

    it('arquivar pede confirmação, e cancelar não faz nada', async () => {
      await openTree();

      const unit = screen
        .getByText('New neighbors')
        .closest('li') as HTMLElement;

      await userEvent.click(
        within(unit).getByRole('button', { name: 'Arquivar' }),
      );

      const dialog = await screen.findByRole('dialog');

      expect(
        within(dialog).getByText('Arquivar a unidade?'),
      ).toBeInTheDocument();

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancelar' }),
      );

      expect(mockState.calls.unitTransitions).toEqual([]);

      await userEvent.click(
        within(unit).getByRole('button', { name: 'Arquivar' }),
      );
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Arquivar',
        }),
      );

      expect(await within(unit).findByText('Arquivado')).toBeInTheDocument();
    });
  });

  it('erro de carregamento mostra a mensagem e deixa tentar de novo', async () => {
    let calls = 0;

    server.use(
      http.get(`${API_URL}/admin/curriculum/courses`, () => {
        calls += 1;

        return calls === 1
          ? HttpResponse.json(
              { error: { code: 'INTERNAL', message: 'Falha no servidor.' } },
              { status: 400 },
            )
          : HttpResponse.json([]);
      }),
    );
    renderAdminAt('/conteudo');

    expect(
      await screen.findByText('Não conseguimos carregar esta tela.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Falha no servidor.')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );

    expect(
      await screen.findByText('Nenhum curso cadastrado'),
    ).toBeInTheDocument();
  });
});
