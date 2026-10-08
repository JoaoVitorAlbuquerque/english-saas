import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ITEM_AM_ID,
  ITEM_ORDER_ID,
  failNext,
  mockState,
} from '../../../mocks/curriculum-mock';
import {
  advanceDrafts,
  seedReadyLessonDraft,
  studioState,
} from '../../../mocks/studio-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openQueue(path = '/estudio') {
  renderAdminAt(path);
  await screen.findByRole('table', { name: 'Rascunhos pedidos à IA' });
}

const rowOf = (name: RegExp) => screen.getByRole('row', { name });

afterEach(() => {
  vi.useRealTimers();
});

describe('Fila de rascunhos', () => {
  it('lista do mais novo ao mais antigo, com status, quem pediu e custo real', async () => {
    await openQueue();

    const rows = screen.getAllByRole('row').slice(1);

    expect(rows).toHaveLength(4);

    const queued = rowOf(/Pedir comida num restaurante/);

    expect(within(queued).getByText('Na fila')).toBeInTheDocument();
    expect(within(queued).getByText('Bruno Lima')).toBeInTheDocument();
    // Ainda sem resposta da IA: sem custo.
    expect(
      within(queued).getByText('—', { selector: 'td' }),
    ).toBeInTheDocument();

    const ready = rowOf(/2 questões/);

    expect(within(ready).getByText('Pronto')).toBeInTheDocument();
    expect(within(ready).getByText('US$ 0,0064')).toBeInTheDocument();
    expect(within(ready).getByText('Editora Teste')).toBeInTheDocument();
    expect(
      within(ready).getByText('Múltipla escolha, Ordenar as palavras', {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it('falhou: mostra o motivo em português, e o custo que já foi gasto', async () => {
    await openQueue();

    const failed = rowOf(/Falar da rotina/);

    expect(within(failed).getByText('Falhou')).toBeInTheDocument();
    expect(within(failed).getByRole('alert')).toHaveTextContent(
      'uma skill ou um personagem não existe',
    );
    expect(within(failed).getByText('US$ 0,0120')).toBeInTheDocument();
  });

  it('filtra por status e por tipo de pedido', async () => {
    await openQueue();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'FAILED');

    await waitFor(() =>
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(1),
    );
    expect(studioState.calls.draftListQueries.at(-1)).toContain(
      'status=FAILED',
    );

    await userEvent.selectOptions(screen.getByLabelText('Status'), '');
    await userEvent.selectOptions(
      screen.getByLabelText('Tipo de pedido'),
      'REGISTER_NOTES',
    );

    await waitFor(() =>
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(1),
    );
    expect(
      within(rowOf(/3 notas de registro/)).getByText('Pronto'),
    ).toBeInTheDocument();
    expect(studioState.calls.draftListQueries.at(-1)).toContain(
      'kind=REGISTER_NOTES',
    );
  });

  it('sem resultado para o filtro, oferece limpar', async () => {
    await openQueue();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'DISCARDED');

    expect(
      await screen.findByText('Nenhum rascunho por aqui'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Limpar filtros' }),
    );

    expect(
      await screen.findByRole('table', { name: 'Rascunhos pedidos à IA' }),
    ).toBeInTheDocument();
  });

  it('"Atualizar agora" traz o estado novo do job', async () => {
    await openQueue();

    expect(
      within(rowOf(/Pedir comida num restaurante/)).getByText('Na fila'),
    ).toBeInTheDocument();

    advanceDrafts();
    await userEvent.click(
      screen.getByRole('button', { name: 'Atualizar agora' }),
    );

    expect(
      await within(rowOf(/Pedir comida num restaurante/)).findByText('Gerando'),
    ).toBeInTheDocument();
  });

  it('enquanto há pedido em andamento a lista se atualiza sozinha, até ficar pronto', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    studioState.autoAdvance = true;

    await openQueue();

    const line = () => rowOf(/Pedir comida num restaurante/);

    // A primeira leitura já andou um estágio.
    expect(await within(line()).findByText('Gerando')).toBeInTheDocument();
    expect(screen.getByText(/a lista se atualiza sozinha/)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3_100));
    expect(
      await within(line()).findByText('Revisão automática'),
    ).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3_100));
    expect(await within(line()).findByText('Pronto')).toBeInTheDocument();
    // Pronto o último pedido, a lista para de perguntar.
    expect(
      await screen.findByText('Nenhum pedido em andamento.'),
    ).toBeInTheDocument();

    const reads = studioState.calls.draftListQueries.length;

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(studioState.calls.draftListQueries).toHaveLength(reads);

    // A lição gerada apareceu com o custo real e os avisos da revisão.
    expect(within(line()).getByText('US$ 0,0435')).toBeInTheDocument();
    expect(within(line()).getByText('2 bloqueadores')).toBeInTheDocument();
  });

  it('o job que falha aparece como falhou, com o motivo', async () => {
    studioState.failNextGeneration = 'AI_PROVIDER_UNAVAILABLE';

    await openQueue();
    advanceDrafts(2);
    await userEvent.click(
      screen.getByRole('button', { name: 'Atualizar agora' }),
    );

    const line = rowOf(/Pedir comida num restaurante/);

    expect(await within(line).findByText('Falhou')).toBeInTheDocument();
    expect(within(line).getByRole('alert')).toHaveTextContent('fora do ar');
  });

  it('rascunho de lição pronto leva à revisão no editor, com os bloqueadores à vista', async () => {
    const { draftId, versionId } = seedReadyLessonDraft();

    await openQueue();

    const line = rowOf(/Fazer o check-in no aeroporto/);

    expect(within(line).getByText('Pronto')).toBeInTheDocument();
    expect(within(line).getByText('2 bloqueadores')).toBeInTheDocument();
    expect(
      within(line).getByRole('link', { name: /^Revisar/ }),
    ).toHaveAttribute('href', `/conteudo/versoes/${versionId}?painel=revisao`);
    expect(draftId).toBeDefined();
  });

  it('o pedido novo vem destacado (?novo=)', async () => {
    await openQueue('/estudio?novo=draft-queued');

    expect(rowOf(/Pedir comida num restaurante/)).toHaveAttribute(
      'data-highlighted',
      'true',
    );
    expect(rowOf(/Falar da rotina/)).toHaveAttribute(
      'data-highlighted',
      'false',
    );
  });

  it('questões prontas: mostra as criadas, cada uma abre no banco', async () => {
    await openQueue();

    const line = rowOf(/2 questões/);

    await userEvent.click(
      within(line).getByRole('button', { name: 'Ver o que foi criado' }),
    );

    expect(
      within(line).getByRole('link', { name: 'Questão 1' }),
    ).toHaveAttribute('href', `/conteudo/questoes/${ITEM_ORDER_ID}`);
    expect(
      within(line).getByRole('link', { name: 'Questão 2' }),
    ).toHaveAttribute('href', `/conteudo/questoes/${ITEM_AM_ID}`);
  });

  it('notas prontas: lista os ids e leva à taxonomia', async () => {
    await openQueue();

    const line = rowOf(/3 notas de registro/);

    await userEvent.click(
      within(line).getByRole('button', { name: 'Ver o que foi criado' }),
    );

    expect(within(line).getByText('gonna')).toBeInTheDocument();
    expect(
      within(line).getByRole('link', { name: 'Abrir as notas de registro' }),
    ).toHaveAttribute('href', '/conteudo/taxonomia/registro');
  });
});

describe('Fila de rascunhos → descartar', () => {
  it('pede confirmação, descarta e arquiva o que o rascunho criou', async () => {
    const { versionId } = seedReadyLessonDraft();

    await openQueue();
    await userEvent.click(
      screen.getByRole('button', {
        name: /^Descartar: A1 · Fazer o check-in no aeroporto/,
      }),
    );

    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByText(/são arquivadas e saem do seu caminho/),
    ).toBeInTheDocument();
    // Cancelar não descarta.
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    );
    expect(studioState.calls.discards).toEqual([]);

    await userEvent.click(
      screen.getByRole('button', {
        name: /^Descartar: A1 · Fazer o check-in no aeroporto/,
      }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Descartar',
      }),
    );

    await waitFor(() =>
      expect(
        within(rowOf(/Fazer o check-in no aeroporto/)).getByText('Descartado'),
      ).toBeInTheDocument(),
    );
    expect(studioState.calls.discards).toHaveLength(1);
    expect(
      mockState.versions.find((version) => version.id === versionId)?.status,
    ).toBe('ARCHIVED');
    // Descartado não oferece descartar de novo.
    expect(
      within(rowOf(/Fazer o check-in no aeroporto/)).queryByRole('button', {
        name: /Descartar/,
      }),
    ).not.toBeInTheDocument();
  });

  it('de notas, avisa que as notas criadas continuam na taxonomia', async () => {
    await openQueue();
    await userEvent.click(
      screen.getByRole('button', { name: /^Descartar: 3 notas de registro/ }),
    );

    expect(
      await within(await screen.findByRole('dialog')).findByText(
        /continuam na taxonomia/,
      ),
    ).toBeInTheDocument();
  });

  it('descartar com erro avisa e deixa o rascunho como estava', async () => {
    failNext('draft-discard', {
      status: 500,
      code: 'INTERNAL',
      message: 'Algo deu errado do nosso lado.',
    });

    await openQueue();
    await userEvent.click(
      screen.getByRole('button', { name: /^Descartar: 3 notas de registro/ }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Descartar',
      }),
    );

    expect(
      await screen.findByText('Não deu para descartar o rascunho.'),
    ).toBeInTheDocument();
    expect(
      within(rowOf(/3 notas de registro/)).getByText('Pronto'),
    ).toBeInTheDocument();
  });

  it('erro ao carregar a fila deixa tentar de novo', async () => {
    failNext('drafts-list', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Você não tem acesso a isto.',
    });

    renderAdminAt('/estudio');

    expect(
      await screen.findByText('Não conseguimos carregar esta tela.'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );

    expect(
      await screen.findByRole('table', { name: 'Rascunhos pedidos à IA' }),
    ).toBeInTheDocument();
  });
});
