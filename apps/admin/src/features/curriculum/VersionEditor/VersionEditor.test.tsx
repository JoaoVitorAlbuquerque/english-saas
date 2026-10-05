import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../test-helpers';

const DRAFT = 'version-2-1';
const PUBLISHED = 'version-1-2';

async function openEditor(versionId = DRAFT, heading = 'Versão 1') {
  renderAdminAt(`/conteudo/versoes/${versionId}`);
  await screen.findByRole('heading', { name: heading });
  // Espera as etapas aparecerem na lista.
  await list().findByRole('button', { name: /^1. Cena/ });
}

/** A lista de etapas do editor — o preview tem botões de mesmo nome. */
const list = () =>
  within(screen.getByRole('navigation', { name: 'Etapas da lição' }));

const stepButton = (name: RegExp) => list().getByRole('button', { name });

function editorPanel(): HTMLElement {
  return document.getElementById('editor-panel') as HTMLElement;
}

function savedSteps(): { type: string; content: Record<string, unknown> }[] {
  const last = mockState.calls.stepSaves.at(-1);

  return (last?.body.steps ?? []) as never;
}

describe('Editor de versão', () => {
  it('abre a versão: lista as etapas e mostra os metadados', async () => {
    await openEditor();

    expect(
      list().getByRole('button', { name: /^1. Cena/ }),
    ).toBeInTheDocument();
    expect(
      list().getByRole('button', { name: /^2. Prática/ }),
    ).toBeInTheDocument();
    expect(
      list().getByRole('button', { name: /^3. Resumo/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nenhum problema encontrado.')).toBeInTheDocument();
    expect(screen.getByText('Tudo salvo')).toBeInTheDocument();
  });

  it('a etapa aberta mostra os campos do tipo dela', async () => {
    await openEditor();

    // A primeira etapa abre direto: é a cena.
    expect(
      within(editorPanel()).getByLabelText('Onde a cena acontece'),
    ).toHaveValue('Corredor do prédio, em Austin');
    expect(within(editorPanel()).getAllByText(/^\d\. fala \d$/)).toHaveLength(
      2,
    );

    await userEvent.click(stepButton(/^2. Prática/));

    expect(
      within(editorPanel()).getByRole('heading', {
        name: 'Questões da prática',
      }),
    ).toBeInTheDocument();
    // A questão aparece na lista da prática (e também na busca do banco).
    expect(
      within(editorPanel()).getAllByText('I ___ Maya.').length,
    ).toBeGreaterThan(0);

    await userEvent.click(stepButton(/^3. Resumo/));

    expect(
      within(editorPanel()).getByRole('heading', {
        name: 'O que o aluno leva da lição',
      }),
    ).toBeInTheDocument();
  });

  it('mostra erro de carregamento e deixa tentar de novo', async () => {
    renderAdminAt('/conteudo/versoes/nao-existe');

    expect(
      await screen.findByText('Não conseguimos abrir esta versão.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    ).toBeInTheDocument();
  });

  describe('metadados', () => {
    it('editar o título salva sozinho e o indicador passa por "alterações" até "salvo"', async () => {
      await openEditor();
      await userEvent.click(screen.getByRole('button', { name: 'Metadados' }));

      const title = within(editorPanel()).getByLabelText('Título');

      await userEvent.clear(title);
      await userEvent.type(title, 'At the coffee shop');

      expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();

      await waitFor(
        () => expect(screen.getByText(/^Salvo às /)).toBeInTheDocument(),
        {
          timeout: 5000,
        },
      );
      expect(mockState.calls.metaSaves).toEqual([
        { id: DRAFT, body: { title: 'At the coffee shop' } },
      ]);
      expect(mockState.versions.find((v) => v.id === DRAFT)?.title).toBe(
        'At the coffee shop',
      );
      // Só o campo que mudou foi.
      expect(mockState.calls.stepSaves).toEqual([]);
    });

    it('campo fora do limite mostra o erro no campo, não é salvo e o indicador avisa', async () => {
      await openEditor();
      await userEvent.click(screen.getByRole('button', { name: 'Metadados' }));

      await userEvent.clear(within(editorPanel()).getByLabelText('Título'));

      expect(
        within(editorPanel()).getByText('Escreva ao menos 2 caracteres.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('1 problema para corrigir antes de enviar.'),
      ).toBeInTheDocument();
      expect(screen.getByText('1 erro')).toBeInTheDocument();

      // Muda outra coisa: o título vazio não vai, o resto vai.
      await userEvent.clear(
        within(editorPanel()).getByLabelText(/Tempo estimado/),
      );
      await userEvent.type(
        within(editorPanel()).getByLabelText(/Tempo estimado/),
        '15',
      );

      await waitFor(() => expect(mockState.calls.metaSaves).toHaveLength(1), {
        timeout: 5000,
      });
      expect(mockState.calls.metaSaves[0]?.body).toEqual({
        estimatedMinutes: 15,
      });
      expect(
        await screen.findByText(
          /Estes campos têm erro e ainda não foram salvos: title/,
        ),
      ).toBeInTheDocument();
    });

    it('skills-alvo: busca por texto e escolhe', async () => {
      await openEditor();
      await userEvent.click(screen.getByRole('button', { name: 'Metadados' }));

      await userEvent.type(
        within(editorPanel()).getByLabelText('Buscar skill por nome ou código'),
        'going',
      );
      await userEvent.click(
        await within(editorPanel()).findByRole('button', {
          name: /Futuro com going to/,
        }),
      );

      expect(
        within(editorPanel()).getByText('Futuro com going to'),
      ).toBeInTheDocument();

      await waitFor(() => expect(mockState.calls.metaSaves).toHaveLength(1), {
        timeout: 5000,
      });
      expect(mockState.calls.metaSaves[0]?.body).toEqual({
        targetSkillIds: ['vocab.cafe', 'grammar.going-to-future'],
      });
    });
  });

  describe('etapas', () => {
    it('adicionar uma prática vazia mostra o erro no campo e na lista', async () => {
      await openEditor();

      await userEvent.click(
        screen.getByRole('button', { name: 'Adicionar etapa: Prática' }),
      );

      // A etapa nova abre sozinha.
      expect(
        within(editorPanel()).getByText('Adicione ao menos um item.'),
      ).toBeInTheDocument();
      expect(
        list().getByRole('button', { name: /^4. Prática/ }),
      ).toHaveTextContent('1 erro');
      expect(
        screen.getByText('1 problema para corrigir antes de enviar.'),
      ).toBeInTheDocument();
    });

    it('escolher questões do banco por nível e skill limpa o erro e salva a ordem', async () => {
      await openEditor();
      await userEvent.click(
        screen.getByRole('button', { name: 'Adicionar etapa: Prática' }),
      );

      const picker = within(editorPanel());

      await userEvent.selectOptions(picker.getByLabelText('Nível'), 'A2');

      expect(await picker.findByText('Ligue as palavras.')).toBeInTheDocument();
      expect(picker.queryByText('I ___ Maya.')).not.toBeInTheDocument();

      await userEvent.selectOptions(picker.getByLabelText('Nível'), '');
      await userEvent.click(
        await picker.findByRole('button', { name: 'Adicionar I ___ Maya.' }),
      );
      await userEvent.click(
        picker.getByRole('button', { name: 'Adicionar Ligue as palavras.' }),
      );

      expect(
        picker.queryByText('Adicione ao menos um item.'),
      ).not.toBeInTheDocument();
      expect(
        picker.getByRole('button', { name: 'Adicionar I ___ Maya.' }),
      ).toBeDisabled();

      await userEvent.click(
        picker.getByRole('button', { name: 'Subir questão 2' }),
      );

      await waitFor(
        () => expect(mockState.calls.stepSaves.length).toBeGreaterThan(0),
        {
          timeout: 5000,
        },
      );

      const practice = savedSteps()[3];

      expect(practice?.type).toBe('PRACTICE');
      expect(practice?.content.itemIds).toEqual([
        '66666666-6666-4666-8666-666666666666',
        '44444444-4444-4444-8444-444444444444',
      ]);
    });

    it('filtra o banco por skill', async () => {
      await openEditor();
      await userEvent.click(
        screen.getByRole('button', { name: 'Adicionar etapa: Prática' }),
      );

      const picker = within(editorPanel());

      await userEvent.type(
        picker.getByLabelText('Buscar skill por nome ou código'),
        'verbo',
      );
      await userEvent.click(
        await picker.findByRole('button', { name: /Verbo to be no presente/ }),
      );

      await waitFor(() =>
        expect(
          mockState.calls.itemQueries.some((q) =>
            q.includes('skillId=grammar.be'),
          ),
        ).toBe(true),
      );
    });

    it('reordenar as etapas muda a ordem salva', async () => {
      await openEditor();

      await userEvent.click(
        screen.getByRole('button', { name: 'Subir 3. Resumo' }),
      );

      expect(
        list()
          .getAllByRole('button', { name: /^\d\. (Cena|Prática|Resumo)/ })
          .map((button) => button.textContent?.replace(/\d erros?/, '')),
      ).toEqual(['1. Cena', '2. Resumo', '3. Prática']);

      await waitFor(() => expect(mockState.calls.stepSaves).toHaveLength(1), {
        timeout: 5000,
      });
      expect(savedSteps().map((step) => step.type)).toEqual([
        'SCENE',
        'SUMMARY',
        'PRACTICE',
      ]);
    });

    it('remover pede confirmação e leva a edição para a etapa vizinha', async () => {
      await openEditor();

      await userEvent.click(
        screen.getByRole('button', { name: 'Remover 3. Resumo' }),
      );

      const dialog = await screen.findByRole('dialog');

      expect(
        within(dialog).getByText(
          /A etapa 3 \(Resumo\) e tudo que foi escrito nela/,
        ),
      ).toBeInTheDocument();

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancelar' }),
      );
      expect(
        list().getByRole('button', { name: /^3. Resumo/ }),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'Remover 3. Resumo' }),
      );
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Remover etapa',
        }),
      );

      expect(
        list().queryByRole('button', { name: /^3. Resumo/ }),
      ).not.toBeInTheDocument();

      await waitFor(() => expect(mockState.calls.stepSaves).toHaveLength(1), {
        timeout: 5000,
      });
      expect(savedSteps().map((step) => step.type)).toEqual([
        'SCENE',
        'PRACTICE',
      ]);
    });

    it('lição sem nenhuma etapa explica o que fazer', async () => {
      const draft = mockState.versions.find((v) => v.id === DRAFT);

      if (draft) {
        draft.steps = [];
      }

      renderAdminAt(`/conteudo/versoes/${DRAFT}`);
      await screen.findByRole('heading', { name: 'Versão 1' });

      expect(
        screen.getByText(
          'Esta lição ainda não tem etapas. Adicione a primeira.',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText('A lição precisa de ao menos uma etapa.'),
      ).toBeInTheDocument();
    });
  });

  describe('salvamento automático', () => {
    it('duas edições seguidas viram um salvamento só', async () => {
      await openEditor();

      const location = within(editorPanel()).getByLabelText(
        'Onde a cena acontece',
      );

      await userEvent.type(location, ' A');
      await userEvent.type(location, 'B');

      await waitFor(
        () => expect(screen.getByText(/^Salvo às /)).toBeInTheDocument(),
        {
          timeout: 5000,
        },
      );

      expect(mockState.calls.stepSaves).toHaveLength(1);
      expect(savedSteps()[0]?.content.location).toBe(
        'Corredor do prédio, em Austin AB',
      );
    });

    it('se a rede falhar, mostra o erro e "Tentar de novo" salva', async () => {
      await openEditor();
      failNext('save-steps', {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Erro no servidor.',
      });

      await userEvent.type(
        within(editorPanel()).getByLabelText('Onde a cena acontece'),
        '!',
      );

      expect(
        await screen.findByText(
          'Não conseguimos salvar',
          {},
          { timeout: 5000 },
        ),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'Tentar de novo' }),
      );

      await waitFor(() =>
        expect(screen.getByText(/^Salvo às /)).toBeInTheDocument(),
      );
      expect(mockState.calls.stepSaves).toHaveLength(2);
    });

    it('editar uma versão em revisão avisa que ela voltou para rascunho', async () => {
      const draft = mockState.versions.find((v) => v.id === DRAFT);

      if (draft) {
        draft.status = 'IN_REVIEW';
      }

      await openEditor();

      expect(screen.getAllByText('Em revisão').length).toBeGreaterThan(0);

      await userEvent.type(
        within(editorPanel()).getByLabelText('Onde a cena acontece'),
        '!',
      );

      expect(
        await screen.findByText(
          /voltou para rascunho porque você a editou/,
          {},
          { timeout: 5000 },
        ),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Rascunho').length).toBeGreaterThan(0);
      expect(mockState.versions.find((v) => v.id === DRAFT)?.status).toBe(
        'DRAFT',
      );
    });
  });

  describe('versão publicada', () => {
    it('abre somente leitura e oferece criar uma nova versão', async () => {
      await openEditor(PUBLISHED, 'Versão 2');

      expect(screen.getByText('Somente leitura')).toBeInTheDocument();
      expect(
        screen.getByText(/Esta versão está publicada e não pode ser editada/),
      ).toBeInTheDocument();
      expect(
        within(editorPanel()).getByLabelText('Onde a cena acontece'),
      ).toHaveAttribute('readonly');
      expect(
        screen.queryByRole('button', { name: 'Adicionar etapa: Prática' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Remover 1. Cena' }),
      ).not.toBeInTheDocument();
    });

    it('"Criar nova versão" abre o rascunho clonado', async () => {
      await openEditor(PUBLISHED, 'Versão 2');

      await userEvent.click(
        screen.getByRole('button', { name: 'Criar nova versão' }),
      );

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          /^\/conteudo\/versoes\/(?!version-1-2)/,
        ),
      );
      expect(
        await screen.findByRole('heading', { name: 'Versão 3' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Tudo salvo')).toBeInTheDocument();
    });
  });
});
