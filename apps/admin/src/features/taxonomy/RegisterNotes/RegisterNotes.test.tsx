import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openNotes() {
  renderAdminAt('/conteudo/taxonomia/registro');
  await screen.findByRole('heading', { name: 'Taxonomia' });
  await screen.findByText('You coming?', { exact: false });
}

const list = () =>
  within(screen.getByRole('list', { name: 'Notas de registro' }));
const writes = () =>
  mockState.calls.bankWrites.filter((w) => w.resource === 'register-note');

describe('Taxonomia → notas de registro', () => {
  it('lista as notas: falado × padrão, registro e nível escritos', async () => {
    await openNotes();

    expect(
      list().getByRole('heading', { name: /gonna.*going to/ }),
    ).toBeInTheDocument();
    expect(
      list().getByRole('heading', { name: /You coming\?.*Are you coming\?/ }),
    ).toBeInTheDocument();
    expect(list().getAllByText('Fala do dia a dia').length).toBeGreaterThan(0);
    // A obsoleta fica de fora.
    expect(
      list().queryByRole('heading', { name: /want to/ }),
    ).not.toBeInTheDocument();
  });

  it('com áudio: botão de ouvir; sem áudio: o aviso de que nasce na aprovação', async () => {
    await openNotes();

    expect(
      list().getByRole('button', { name: 'Ouvir "gonna"' }),
    ).toBeInTheDocument();
    expect(list().getAllByText('Com áudio')).toHaveLength(1);
    expect(
      list().getByText(
        'Sem áudio ainda — ele é gerado quando a lição que usa a nota é aprovada.',
      ),
    ).toBeInTheDocument();
  });

  it('filtra por nível e por registro', async () => {
    await openNotes();

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A2');

    await waitFor(() =>
      expect(
        list().queryByRole('heading', { name: /You coming\?/ }),
      ).not.toBeInTheDocument(),
    );
    expect(
      list().getByRole('heading', { name: /gonna.*going to/ }),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Nível'), '');
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Mostrar obsoletas' }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Registro'), 'NEUTRAL');

    expect(
      await list().findByRole('heading', { name: /want to/ }),
    ).toBeInTheDocument();
    expect(list().getByText('Obsoleta')).toBeInTheDocument();
    expect(
      mockState.calls.listQueries.some(
        (query) =>
          query.resource === 'register-notes' &&
          query.search.includes('register=NEUTRAL') &&
          query.search.includes('includeDeprecated=true'),
      ),
    ).toBe(true);
  });

  it('cria uma nota ligada a uma skill de registro', async () => {
    await openNotes();

    await userEvent.click(screen.getByRole('button', { name: 'Nova nota' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.type(
      within(dialog).getByLabelText(/Identificador/),
      'wanna',
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Como se fala/),
      'wanna',
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Estrutura completa/),
      'want to',
    );
    await userEvent.type(
      within(dialog).getByLabelText(/O que muda e quando usar/),
      'Forma curta de want to na fala.',
    );

    // O seletor só oferece skills do tipo REGISTER.
    await userEvent.type(within(dialog).getByLabelText(/Buscar skill/), 'o');

    expect(
      await within(dialog).findByRole('button', { name: /Registro: gonna/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: /Verbo to be/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: /Registro: gonna/ }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    // `register.gonna` já é da nota "gonna": a API explica no campo.
    expect(
      await within(dialog).findByText(/já está ligada à nota "gonna"/),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writes()).toHaveLength(1);

    // Sem a skill, salva.
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Tirar Registro: gonna',
      }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(
      await list().findByText('Forma curta de want to na fala.'),
    ).toBeInTheDocument();
    expect(writes().at(-1)?.body).toMatchObject({
      id: 'wanna',
      spokenForm: 'wanna',
      standardForm: 'want to',
      register: 'INFORMAL_SPOKEN',
      cefrLevel: 'A1',
      skillId: null,
      whenToAvoid: null,
    });
    // O áudio não é editado aqui.
    expect(writes().at(-1)?.body).not.toHaveProperty('audioAssetId');
  });

  it('campos obrigatórios em branco aparecem no campo', async () => {
    await openNotes();

    await userEvent.click(screen.getByRole('button', { name: 'Nova nota' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(
      within(dialog).getAllByText(/Preencha este campo|Escreva ao menos/)
        .length,
    ).toBeGreaterThanOrEqual(3);
    expect(writes()).toEqual([]);
  });

  it('editar: identificador travado, áudio só para ouvir', async () => {
    await openNotes();

    await userEvent.click(screen.getByRole('button', { name: 'Editar gonna' }));

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText(/Identificador/)).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Ouvir "gonna"' }),
    ).toBeInTheDocument();

    await userEvent.clear(
      within(dialog).getByLabelText(/O que muda e quando usar/),
    );
    await userEvent.type(
      within(dialog).getByLabelText(/O que muda e quando usar/),
      'Forma falada de going to.',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(
      await list().findByText('Forma falada de going to.'),
    ).toBeInTheDocument();
    expect(writes()[0]).toMatchObject({ action: 'update', id: 'gonna' });
    expect(writes()[0]?.body).not.toHaveProperty('id');
    expect(writes()[0]?.body).not.toHaveProperty('audioAssetId');
    // O áudio segue ligado depois de salvar.
    expect(
      list().getByRole('button', { name: 'Ouvir "gonna"' }),
    ).toBeInTheDocument();
  });

  it('marcar como obsoleta, com substituta que não seja ela mesma', async () => {
    await openNotes();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Marcar you-coming como obsoleta'.replace(
          'you-coming',
          'You coming?',
        ),
      }),
    );

    const dialog = await screen.findByRole('dialog');

    await userEvent.selectOptions(
      within(dialog).getByLabelText('Nota que a substitui'),
      'gonna',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Marcar como obsoleta' }),
    );

    await waitFor(() =>
      expect(
        list().queryByRole('heading', { name: /You coming\?/ }),
      ).not.toBeInTheDocument(),
    );
    expect(writes().find((w) => w.action === 'deprecate')).toEqual({
      resource: 'register-note',
      action: 'deprecate',
      id: 'you-coming',
      body: { replacedById: 'gonna' },
    });
  });

  it('erro ao salvar sem campo próprio vai para o diálogo', async () => {
    failNext('save-register-note', {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Algo deu errado do nosso lado.',
    });
    await openNotes();

    await userEvent.click(screen.getByRole('button', { name: 'Editar gonna' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Algo deu errado do nosso lado.',
    );
  });
});
