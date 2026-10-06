import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openSkills() {
  renderAdminAt('/conteudo/taxonomia/skills');
  await screen.findByRole('heading', { name: 'Taxonomia' });
  await screen.findByText('Verbo to be no presente');
}

const list = () => within(screen.getByRole('list', { name: 'Skills' }));
const queries = () =>
  mockState.calls.listQueries
    .filter((query) => query.resource === 'skills')
    .map((query) => query.search);

describe('Taxonomia → skills', () => {
  it('lista as skills em circulação e esconde as obsoletas', async () => {
    await openSkills();

    expect(list().getByText('Futuro com going to')).toBeInTheDocument();
    expect(list().getByText('Registro: gonna')).toBeInTheDocument();
    expect(
      list().queryByText('Verbo to be (versão antiga)'),
    ).not.toBeInTheDocument();
    // Tipo, competência e nível aparecem escritos.
    expect(list().getAllByText('Estrutura gramatical').length).toBeGreaterThan(
      0,
    );
    expect(list().getAllByText('Gramática').length).toBeGreaterThan(0);
  });

  it('"Mostrar obsoletas" traz a antiga, com o selo e a substituta', async () => {
    await openSkills();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Mostrar obsoletas' }),
    );

    expect(
      await list().findByText('Verbo to be (versão antiga)'),
    ).toBeInTheDocument();
    expect(list().getByText('Obsoleta')).toBeInTheDocument();
    expect(list().getByText(/Substituída por/)).toBeInTheDocument();
    expect(queries().at(-1)).toContain('includeDeprecated=true');
    // Skill obsoleta não oferece "marcar como obsoleta" de novo.
    expect(
      screen.queryByRole('button', {
        name: 'Marcar Verbo to be (versão antiga) como obsoleta',
      }),
    ).not.toBeInTheDocument();
  });

  it('filtra por nível, competência e tipo — a API é quem filtra', async () => {
    await openSkills();

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A2');

    await waitFor(() =>
      expect(list().queryByText('Nice to meet you')).not.toBeInTheDocument(),
    );
    expect(list().getByText('Futuro com going to')).toBeInTheDocument();
    expect(queries().at(-1)).toContain('level=A2');

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'REGISTER');

    await waitFor(() =>
      expect(list().queryByText('Futuro com going to')).not.toBeInTheDocument(),
    );
    expect(list().getByText('Registro: gonna')).toBeInTheDocument();
    expect(queries().at(-1)).toContain('type=REGISTER');

    await userEvent.selectOptions(screen.getByLabelText('Nível'), '');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), '');
    await userEvent.selectOptions(
      screen.getByLabelText('Competência'),
      'VOCABULARY',
    );

    expect(await list().findByText('Pedir um café')).toBeInTheDocument();
    expect(list().queryByText('Nice to meet you')).not.toBeInTheDocument();
  });

  it('busca por texto e limpa os filtros quando nada bate', async () => {
    await openSkills();

    await userEvent.type(screen.getByLabelText('Buscar'), 'zzz');

    expect(
      await screen.findByText('Nenhuma skill por aqui'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nada bate com esses filtros.'),
    ).toBeInTheDocument();
    expect(queries().at(-1)).toContain('q=zzz');

    await userEvent.click(
      screen.getByRole('button', { name: 'Limpar filtros' }),
    );

    expect(
      await screen.findByText('Verbo to be no presente'),
    ).toBeInTheDocument();
  });

  it('"Carregar mais" traz a próxima página pelo cursor', async () => {
    for (let n = 0; n < 35; n += 1) {
      mockState.skills.push({
        id: `vocab.extra-${String(n).padStart(2, '0')}`,
        type: 'VOCAB_SET',
        competency: 'VOCABULARY',
        cefrLevel: 'B1',
        title: `Extra ${String(n)}`,
        description: null,
        prerequisites: [],
        commonErrors: [],
        goals: [],
        deprecatedAt: null,
        replacedById: null,
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      });
    }

    await openSkills();

    expect(list().getAllByRole('listitem')).toHaveLength(30);

    await userEvent.click(
      screen.getByRole('button', { name: 'Carregar mais' }),
    );

    await waitFor(() =>
      expect(list().getAllByRole('listitem')).toHaveLength(40),
    );
    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
    ).not.toBeInTheDocument();
  });

  describe('criar e editar', () => {
    it('cria uma skill com pré-requisito e erro comum', async () => {
      await openSkills();

      await userEvent.click(screen.getByRole('button', { name: 'Nova skill' }));

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(
        within(dialog).getByLabelText(/Identificador/),
        'grammar.have-got',
      );
      await userEvent.type(within(dialog).getByLabelText('Título'), 'Have got');
      await userEvent.selectOptions(
        within(dialog).getByLabelText('Nível'),
        'A2',
      );
      await userEvent.type(
        within(dialog).getByLabelText('Descrição'),
        'Posse com have got.',
      );
      await userEvent.click(
        within(dialog).getByRole('checkbox', { name: 'Viajar' }),
      );

      // Pré-requisito: busca e escolhe.
      await userEvent.type(
        within(dialog).getByLabelText(/Buscar skill/),
        'Verbo to be',
      );
      await userEvent.click(
        await within(dialog).findByRole('button', {
          name: /Verbo to be no presente/,
        }),
      );

      // Erro comum.
      await userEvent.click(
        await within(dialog).findByRole('button', { name: 'I have 20 years.' }),
      );

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      );

      expect(await list().findByText('Have got')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        mockState.calls.bankWrites.filter((w) => w.resource === 'skill'),
      ).toEqual([
        {
          resource: 'skill',
          action: 'create',
          id: 'grammar.have-got',
          body: {
            id: 'grammar.have-got',
            type: 'GRAMMAR',
            competency: 'GRAMMAR',
            cefrLevel: 'A2',
            title: 'Have got',
            description: 'Posse com have got.',
            prerequisites: ['grammar.be.present.affirmative'],
            commonErrors: ['l1.have-for-age'],
            goals: ['TRAVEL'],
          },
        },
      ]);
    });

    it('identificador fora do padrão e título curto são barrados antes da API', async () => {
      await openSkills();

      await userEvent.click(screen.getByRole('button', { name: 'Nova skill' }));

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(
        within(dialog).getByLabelText(/Identificador/),
        'Com Espaço',
      );
      await userEvent.type(within(dialog).getByLabelText('Título'), 'x');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      );

      expect(
        within(dialog).getByText('Escreva ao menos 2 caracteres.'),
      ).toBeInTheDocument();
      expect(
        mockState.calls.bankWrites.filter((w) => w.resource === 'skill'),
      ).toEqual([]);
    });

    it('identificador repetido aparece no campo', async () => {
      await openSkills();

      await userEvent.click(screen.getByRole('button', { name: 'Nova skill' }));

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(
        within(dialog).getByLabelText(/Identificador/),
        'vocab.cafe',
      );
      await userEvent.type(within(dialog).getByLabelText('Título'), 'Café 2');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      );

      expect(
        await within(dialog).findByText(
          'Já existe conteúdo com o identificador "vocab.cafe".',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('editar: o identificador fica travado e vai só o que a tela manda, sem o id', async () => {
      await openSkills();

      await userEvent.click(
        screen.getByRole('button', { name: 'Editar Pedir um café' }),
      );

      const dialog = await screen.findByRole('dialog');

      expect(within(dialog).getByLabelText(/Identificador/)).toBeDisabled();
      expect(within(dialog).getByLabelText(/Identificador/)).toHaveValue(
        'vocab.cafe',
      );

      await userEvent.clear(within(dialog).getByLabelText('Título'));
      await userEvent.type(
        within(dialog).getByLabelText('Título'),
        'Pedir comida e bebida',
      );
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      );

      expect(
        await list().findByText('Pedir comida e bebida'),
      ).toBeInTheDocument();

      const [write] = mockState.calls.bankWrites.filter(
        (w) => w.resource === 'skill',
      );

      expect(write).toMatchObject({ action: 'update', id: 'vocab.cafe' });
      expect(write?.body).not.toHaveProperty('id');
      expect(write?.body).toMatchObject({ title: 'Pedir comida e bebida' });
    });

    it('a própria skill não aparece como pré-requisito possível', async () => {
      await openSkills();

      await userEvent.click(
        screen.getByRole('button', { name: 'Editar Verbo to be no presente' }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(
        within(dialog).getByLabelText(/Buscar skill/),
        'Verbo to be',
      );

      expect(
        await within(dialog).findByText('Nenhuma skill encontrada.'),
      ).toBeInTheDocument();
    });

    it('pré-requisito que fecha ciclo é recusado, com o caminho, no campo', async () => {
      await openSkills();

      // `Futuro com going to` exige `Verbo to be`; o contrário fecharia o ciclo.
      await userEvent.click(
        screen.getByRole('button', { name: 'Editar Verbo to be no presente' }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.type(
        within(dialog).getByLabelText(/Buscar skill/),
        'Futuro',
      );
      await userEvent.click(
        await within(dialog).findByRole('button', {
          name: /Futuro com going to/,
        }),
      );
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar' }),
      );

      const message = await within(dialog).findByText(/formam um ciclo/);

      expect(message).toHaveTextContent(
        'grammar.be.present.affirmative → grammar.going-to-future → grammar.be.present.affirmative',
      );
      // Nada foi gravado e o diálogo segue aberto.
      expect(
        mockState.skills.find(
          (skill) => skill.id === 'grammar.be.present.affirmative',
        )?.prerequisites,
      ).toEqual([]);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('marcar como obsoleta', () => {
    it('com substituta: some da lista e a API recebe a substituta', async () => {
      await openSkills();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Marcar Nice to meet you como obsoleta',
        }),
      );

      const dialog = await screen.findByRole('dialog');

      expect(
        within(dialog).getByText('Marcar "Nice to meet you" como obsoleta?'),
      ).toBeInTheDocument();

      await userEvent.type(
        within(dialog).getByLabelText(/Buscar skill/),
        'Pedir',
      );
      await userEvent.click(
        await within(dialog).findByRole('button', { name: /Pedir um café/ }),
      );
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Marcar como obsoleta' }),
      );

      await waitFor(() =>
        expect(list().queryByText('Nice to meet you')).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        mockState.calls.bankWrites.filter((w) => w.action === 'deprecate'),
      ).toEqual([
        {
          resource: 'skill',
          action: 'deprecate',
          id: 'chunk.nice-to-meet-you',
          body: { replacedById: 'vocab.cafe' },
        },
      ]);
    });

    it('sem substituta também vale', async () => {
      await openSkills();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Marcar Pedir um café como obsoleta',
        }),
      );
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Marcar como obsoleta',
        }),
      );

      await waitFor(() =>
        expect(list().queryByText('Pedir um café')).not.toBeInTheDocument(),
      );
      expect(
        mockState.calls.bankWrites.find((w) => w.action === 'deprecate')?.body,
      ).toEqual({ replacedById: null });
    });

    it('cancelar não marca nada', async () => {
      await openSkills();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Marcar Pedir um café como obsoleta',
        }),
      );
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Cancelar',
        }),
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockState.calls.bankWrites).toEqual([]);
      expect(list().getByText('Pedir um café')).toBeInTheDocument();
    });

    it('a API recusando mostra o motivo no diálogo e não fecha', async () => {
      failNext('deprecate-skill', {
        status: 422,
        code: 'MISSING_REFERENCES',
        message: 'O conteúdo aponta para coisas que não existem.',
      });

      await openSkills();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Marcar Pedir um café como obsoleta',
        }),
      );

      const dialog = await screen.findByRole('dialog');

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Marcar como obsoleta' }),
      );

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'O conteúdo aponta para coisas que não existem.',
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
