import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { studioState } from '../../../mocks/studio-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openWorkbooks() {
  renderAdminAt('/estudio/apostilas');
  await screen.findByRole('table', { name: 'Apostilas por unidade' });
}

const line = (unit: string) => screen.getByRole('row', { name: unit });

describe('Apostilas por unidade', () => {
  it('uma linha por unidade: status, quando foi gerada, tamanho e o PDF', async () => {
    await openWorkbooks();

    const done = line('New neighbors');

    expect(within(done).getByText('Em dia')).toBeInTheDocument();
    expect(within(done).getByText('47 KB')).toBeInTheDocument();
    // 1 lição publicada na unidade (a outra ainda é rascunho).
    expect(within(done).getByText('1', { selector: 'td' })).toBeInTheDocument();
    expect(
      within(done).getByRole('link', { name: 'Baixar: New neighbors' }),
    ).toHaveAttribute('href', 'http://localhost/pdf/a1-u1-new-neighbors.pdf');
    expect(
      within(done).getByRole('link', { name: 'Baixar: New neighbors' }),
    ).toHaveAttribute('target', '_blank');

    const none = line('First day');

    expect(within(none).getByText('Sem apostila')).toBeInTheDocument();
    expect(
      within(none).queryByRole('link', { name: /Baixar/ }),
    ).not.toBeInTheDocument();
  });

  it('sem lição publicada não há o que gerar', async () => {
    await openWorkbooks();

    const none = line('First day');

    expect(
      within(none).getByRole('button', { name: 'Gerar: First day' }),
    ).toBeDisabled();
    expect(
      within(none).getByText(/Sem lição publicada, não há o que pôr no PDF/),
    ).toBeInTheDocument();
  });

  it('conteúdo publicado que mudou depois do PDF aparece como desatualizado', async () => {
    const workbook = studioState.workbooks.get('unit-1');

    if (workbook) {
      workbook.signature = 'de-antes-da-publicacao';
    }

    await openWorkbooks();

    const stale = line('New neighbors');

    expect(within(stale).getByText('Desatualizada')).toBeInTheDocument();
    expect(
      within(stale).getByText(/O conteúdo publicado mudou depois deste PDF/),
    ).toBeInTheDocument();
  });

  it('regerar: acompanha o job e a apostila volta em dia, com o PDF novo', async () => {
    const workbook = studioState.workbooks.get('unit-1');

    if (workbook) {
      workbook.signature = 'velha';
    }

    await openWorkbooks();
    await userEvent.click(
      within(line('New neighbors')).getByRole('button', {
        name: 'Gerar de novo: New neighbors',
      }),
    );

    await waitFor(() =>
      expect(studioState.calls.workbookRegenerations).toEqual(['unit-1']),
    );
    await waitFor(
      () =>
        expect(
          within(line('New neighbors')).getByText('Em dia'),
        ).toBeInTheDocument(),
      { timeout: 4_000 },
    );
    // O tamanho do PDF novo, e a apostila segue baixável.
    expect(
      within(line('New neighbors')).getByText('54 KB'),
    ).toBeInTheDocument();
  });

  it('enquanto o job roda, o botão fica ocupado e o status diz "Gerando…"', async () => {
    studioState.jobReads = 99;

    await openWorkbooks();
    await userEvent.click(
      within(line('New neighbors')).getByRole('button', {
        name: 'Gerar de novo: New neighbors',
      }),
    );

    expect(
      await within(line('New neighbors')).findByText('Gerando…', {
        selector: 'span',
      }),
    ).toBeInTheDocument();
    expect(
      within(line('New neighbors')).getByRole('button', {
        name: 'Gerar de novo: New neighbors',
      }),
    ).toBeDisabled();
  });

  it('o servidor recusar a geração aparece na linha', async () => {
    failNext('workbook-regenerate', {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Não deu para enfileirar a apostila.',
    });

    await openWorkbooks();
    await userEvent.click(
      within(line('New neighbors')).getByRole('button', {
        name: 'Gerar de novo: New neighbors',
      }),
    );

    expect(
      await within(line('New neighbors')).findByRole('alert'),
    ).toHaveTextContent('Não deu para enfileirar a apostila.');
  });

  it('filtra por nível', async () => {
    await openWorkbooks();

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A2');

    expect(
      await screen.findByText('Nenhuma unidade por aqui'),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A1');

    expect(
      await screen.findByRole('row', { name: 'First day' }),
    ).toBeInTheDocument();
    expect(mockState.units).toHaveLength(2);
  });

  it('erro ao carregar deixa tentar de novo', async () => {
    failNext('workbooks-list', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Você não tem acesso a isto.',
    });

    renderAdminAt('/estudio/apostilas');

    expect(
      await screen.findByText('Não conseguimos carregar esta tela.'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );

    expect(
      await screen.findByRole('table', { name: 'Apostilas por unidade' }),
    ).toBeInTheDocument();
  });
});
