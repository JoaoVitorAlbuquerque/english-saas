import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openErrors() {
  renderAdminAt('/conteudo/taxonomia/erros');
  await screen.findByRole('heading', { name: 'Taxonomia' });
  await screen.findByText('Usa "have" para dizer a idade.');
}

const list = () => within(screen.getByRole('list', { name: 'Erros típicos' }));

describe('Taxonomia → erros típicos', () => {
  it('lista os erros em circulação, com a forma errada e a certa', async () => {
    await openErrors();

    expect(list().getByText('I have 20 years.')).toBeInTheDocument();
    expect(list().getByText("I'm 20 years old.")).toBeInTheDocument();
    expect(
      list().getByText('Esquece o sujeito: "Is raining".'),
    ).toBeInTheDocument();
    expect(
      list().queryByText('Padrão antigo, já substituído.'),
    ).not.toBeInTheDocument();
    expect(list().getByText('Ligado a 1 skill(s)')).toBeInTheDocument();
  });

  it('mostrar obsoletas traz o antigo, com o selo e a substituta', async () => {
    await openErrors();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Mostrar obsoletas' }),
    );

    expect(
      await list().findByText('Padrão antigo, já substituído.'),
    ).toBeInTheDocument();
    expect(list().getByText('Obsoleta')).toBeInTheDocument();
    expect(
      list().getByText('l1.have-for-age', { selector: 'span.font-mono' }),
    ).toBeInTheDocument();
  });

  it('busca por texto', async () => {
    await openErrors();

    await userEvent.type(screen.getByLabelText('Buscar'), 'sujeito');

    await waitFor(() =>
      expect(
        list().queryByText('Usa "have" para dizer a idade.'),
      ).not.toBeInTheDocument(),
    );
    expect(
      list().getByText('Esquece o sujeito: "Is raining".'),
    ).toBeInTheDocument();
    expect(
      mockState.calls.listQueries.some(
        (query) =>
          query.resource === 'error-patterns' &&
          query.search.includes('q=sujeito'),
      ),
    ).toBe(true);
  });

  it('cria um erro típico ligado a uma skill', async () => {
    await openErrors();

    await userEvent.click(
      screen.getByRole('button', { name: 'Novo erro típico' }),
    );

    const dialog = await screen.findByRole('dialog');

    await userEvent.type(
      within(dialog).getByLabelText(/Identificador/),
      'article.country-the',
    );
    await userEvent.type(
      within(dialog).getByLabelText('O que o aluno faz de errado'),
      'Põe the antes de país sem necessidade.',
    );
    await userEvent.type(
      within(dialog).getByLabelText('Forma errada'),
      'I live in the Brazil.',
    );
    await userEvent.type(
      within(dialog).getByLabelText('Forma certa'),
      'I live in Brazil.',
    );
    await userEvent.type(
      within(dialog).getByLabelText('Por que acontece e como lembrar'),
      'País não leva artigo, salvo exceções.',
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Buscar skill/),
      'Verbo to be',
    );
    await userEvent.click(
      await within(dialog).findByRole('button', {
        name: /Verbo to be no presente/,
      }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(
      await list().findByText('Põe the antes de país sem necessidade.'),
    ).toBeInTheDocument();
    expect(
      mockState.calls.bankWrites.filter((w) => w.resource === 'error-pattern'),
    ).toEqual([
      {
        resource: 'error-pattern',
        action: 'create',
        id: 'article.country-the',
        body: {
          id: 'article.country-the',
          description: 'Põe the antes de país sem necessidade.',
          example: 'I live in the Brazil.',
          correction: 'I live in Brazil.',
          explanation: 'País não leva artigo, salvo exceções.',
          skillIds: ['grammar.be.present.affirmative'],
        },
      },
    ]);
  });

  it('campos curtos e identificador repetido aparecem no campo', async () => {
    await openErrors();

    await userEvent.click(
      screen.getByRole('button', { name: 'Novo erro típico' }),
    );

    const dialog = await screen.findByRole('dialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(
      within(dialog).getAllByText(/Escreva ao menos|Preencha este campo/)
        .length,
    ).toBeGreaterThanOrEqual(4);
    expect(mockState.calls.bankWrites).toEqual([]);

    await userEvent.type(
      within(dialog).getByLabelText(/Identificador/),
      'l1.have-for-age',
    );
    await userEvent.type(
      within(dialog).getByLabelText('O que o aluno faz de errado'),
      'Outra descrição qualquer.',
    );
    await userEvent.type(within(dialog).getByLabelText('Forma errada'), 'x');
    await userEvent.type(within(dialog).getByLabelText('Forma certa'), 'y');
    await userEvent.type(
      within(dialog).getByLabelText('Por que acontece e como lembrar'),
      'Explicação qualquer.',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(
      await within(dialog).findByText(
        'Já existe conteúdo com o identificador "l1.have-for-age".',
      ),
    ).toBeInTheDocument();
  });

  it('editar: identificador travado, e as skills ligadas vão no corpo', async () => {
    await openErrors();

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar l1.have-for-age' }),
    );

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText(/Identificador/)).toBeDisabled();

    await userEvent.clear(within(dialog).getByLabelText('Forma certa'));
    await userEvent.type(
      within(dialog).getByLabelText('Forma certa'),
      "I'm twenty.",
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(await list().findByText("I'm twenty.")).toBeInTheDocument();

    const write = mockState.calls.bankWrites.find(
      (w) => w.resource === 'error-pattern',
    );

    expect(write).toMatchObject({ action: 'update', id: 'l1.have-for-age' });
    expect(write?.body).not.toHaveProperty('id');
    expect(write?.body).toMatchObject({
      correction: "I'm twenty.",
      skillIds: ['grammar.be.present.affirmative'],
    });
  });

  it('marcar como obsoleto com substituto', async () => {
    await openErrors();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Marcar l1.missing-subject como obsoleto',
      }),
    );

    const dialog = await screen.findByRole('dialog');

    // O próprio erro não é oferecido como substituto.
    expect(
      within(dialog).queryByRole('option', { name: /Is raining/ }),
    ).not.toBeInTheDocument();

    await userEvent.selectOptions(
      within(dialog).getByLabelText('Erro típico que o substitui'),
      'l1.have-for-age',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Marcar como obsoleta' }),
    );

    await waitFor(() =>
      expect(
        list().queryByText('Esquece o sujeito: "Is raining".'),
      ).not.toBeInTheDocument(),
    );
    expect(
      mockState.calls.bankWrites.find((w) => w.action === 'deprecate'),
    ).toEqual({
      resource: 'error-pattern',
      action: 'deprecate',
      id: 'l1.missing-subject',
      body: { replacedById: 'l1.have-for-age' },
    });
  });

  it('falha ao salvar mostra o motivo no diálogo', async () => {
    failNext('save-error-pattern', {
      status: 422,
      code: 'MISSING_REFERENCES',
      message: 'O conteúdo aponta para coisas que não existem.',
    });
    await openErrors();

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar l1.have-for-age' }),
    );

    const dialog = await screen.findByRole('dialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'O conteúdo aponta para coisas que não existem.',
    );
  });
});
