import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  LUCAS_ID,
  MAYA_ID,
  SKILL_BE,
  failNext,
  mockState,
} from '../../../mocks/curriculum-mock';
import {
  LESSON_1_UUID,
  UNIT_1_UUID,
  giveUuidsToContent,
  studioState,
} from '../../../mocks/studio-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openNewDraft(search = '') {
  giveUuidsToContent();
  renderAdminAt(`/estudio/novo${search}`);
  await screen.findByRole('heading', { name: 'Estúdio de conteúdo' });
}

async function pickSkill(label: RegExp, name: RegExp) {
  await userEvent.type(screen.getByLabelText(/Buscar skill/), 'Verbo to be');
  await userEvent.click(await screen.findByRole('button', { name }));
  expect(label).toBeDefined();
}

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: 'Pedir rascunho' }));

describe('Novo rascunho → lição', () => {
  it('mostra o custo estimado pela média dos pedidos anteriores', async () => {
    await openNewDraft();

    expect(await screen.findByTestId('cost-estimate')).toHaveTextContent(
      'Custo estimado: ~US$ 0,0420 · média de 6 pedidos parecidos',
    );
  });

  it('sem histórico, diz que não há estimativa em vez de inventar uma', async () => {
    studioState.estimates.LESSON = null;

    await openNewDraft();

    expect(await screen.findByTestId('cost-estimate')).toHaveTextContent(
      'Sem estimativa ainda',
    );
  });

  it('enviar vazio aponta o que falta, em português, e não pede nada', async () => {
    await openNewDraft();
    await submit();

    expect(await screen.findByText('Escolha o nível.')).toBeInTheDocument();
    expect(screen.getByText('Escolha a unidade.')).toBeInTheDocument();
    expect(
      screen.getByText('Dê um identificador à lição.'),
    ).toBeInTheDocument();
    expect(studioState.calls.draftRequests).toEqual([]);
  });

  it('pede a lição: unidade, posição sugerida, elenco da unidade e skills-alvo', async () => {
    const [unit] = mockState.units;

    if (unit) {
      unit.castIds = [MAYA_ID, LUCAS_ID];
    }

    await openNewDraft();

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A1');
    await userEvent.selectOptions(
      await screen.findByLabelText('Unidade'),
      await screen.findByRole('option', { name: 'New neighbors' }),
    );

    // O elenco da unidade já vem marcado; a posição é a seguinte à última lição.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Maya/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(screen.getByRole('button', { name: /Lucas/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Posição na unidade')).toHaveValue('2'),
    );

    // O identificador acompanha o título.
    await userEvent.type(
      screen.getByLabelText('Título (opcional)'),
      'At the airport',
    );
    expect(screen.getByLabelText('Identificador')).toHaveValue(
      'at-the-airport',
    );

    await userEvent.type(
      screen.getByLabelText('Objetivo da lição'),
      'Fazer o check-in no aeroporto.',
    );
    await pickSkill(/Skills-alvo/, /Verbo to be no presente/);

    await submit();

    // Vai para a fila, com o pedido novo em destaque.
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/estudio$/),
    );
    expect(studioState.calls.draftRequests).toHaveLength(1);
    expect(studioState.calls.draftRequests[0]).toMatchObject({
      kind: 'LESSON',
      body: {
        unitId: UNIT_1_UUID,
        slug: 'at-the-airport',
        title: 'At the airport',
        order: 2,
        level: 'A1',
        objective: 'Fazer o check-in no aeroporto.',
        targetSkillIds: [SKILL_BE],
        characterIds: [MAYA_ID, LUCAS_ID],
      },
    });

    const row = await screen.findByRole('row', {
      name: /A1 · Fazer o check-in no aeroporto\./,
    });

    expect(row).toHaveAttribute('data-highlighted', 'true');
    expect(within(row).getByText('Na fila')).toBeInTheDocument();
  });

  it('o servidor recusar o pedido aparece no formulário, sem sair da tela', async () => {
    failNext('draft-request', {
      status: 422,
      code: 'DRAFT_REQUEST_INVALID',
      message: 'O pedido precisa de ao menos uma skill-alvo que exista.',
    });

    await openNewDraft();
    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A1');
    await userEvent.selectOptions(
      await screen.findByLabelText('Unidade'),
      await screen.findByRole('option', { name: 'New neighbors' }),
    );
    await userEvent.type(
      screen.getByLabelText('Identificador'),
      'at-the-airport',
    );
    await userEvent.type(
      screen.getByLabelText('Objetivo da lição'),
      'Fazer o check-in no aeroporto.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Maya/ }));
    await pickSkill(/Skills-alvo/, /Verbo to be no presente/);
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O pedido precisa de ao menos uma skill-alvo que exista.',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/estudio\/novo$/,
    );
  });

  it('lição que já existe: escolhe a lição da unidade em vez de criar uma', async () => {
    await openNewDraft();

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A1');
    await userEvent.selectOptions(
      await screen.findByLabelText('Unidade'),
      await screen.findByRole('option', { name: 'New neighbors' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Lição que já existe' }),
    );

    expect(screen.queryByLabelText('Identificador')).not.toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Lição' }),
      await screen.findByRole('option', { name: /nice-to-meet-you/ }),
    );
    await userEvent.type(
      screen.getByLabelText('Objetivo da lição'),
      'Refazer a apresentação.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Maya/ }));
    await pickSkill(/Skills-alvo/, /Verbo to be no presente/);
    await submit();

    await waitFor(() =>
      expect(studioState.calls.draftRequests).toHaveLength(1),
    );
    expect(studioState.calls.draftRequests[0]?.body).toMatchObject({
      lessonId: LESSON_1_UUID,
      objective: 'Refazer a apresentação.',
    });
    expect(studioState.calls.draftRequests[0]?.body).not.toHaveProperty('slug');
  });
});

describe('Novo rascunho → questões', () => {
  it('a estimativa acompanha a quantidade; os tipos padrão vêm marcados', async () => {
    await openNewDraft('?tipo=questoes');

    const estimate = await screen.findByTestId('cost-estimate');

    // 5 questões por padrão a 3.200 micros cada.
    await waitFor(() => expect(estimate).toHaveTextContent('~US$ 0,0160'));

    const count = screen.getByLabelText('Quantas questões');

    await userEvent.clear(count);
    await userEvent.type(count, '8');

    await waitFor(() => expect(estimate).toHaveTextContent('~US$ 0,0256'));
    expect(
      screen.getByRole('button', { name: 'Múltipla escolha' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ditado' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('pede as questões com os tipos escolhidos', async () => {
    await openNewDraft('?tipo=questoes');

    await userEvent.type(screen.getByLabelText(/Buscar skill/), 'Verbo to be');
    await userEvent.click(
      await screen.findByRole('button', { name: /Verbo to be no presente/ }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A1');
    await userEvent.click(screen.getByRole('button', { name: 'Ditado' }));
    await submit();

    await waitFor(() =>
      expect(studioState.calls.draftRequests).toHaveLength(1),
    );
    expect(studioState.calls.draftRequests[0]).toMatchObject({
      kind: 'ITEMS',
      body: {
        skillId: SKILL_BE,
        level: 'A1',
        count: 5,
        types: ['MULTIPLE_CHOICE', 'FILL_BLANK', 'ORDER_WORDS', 'DICTATION'],
      },
    });
  });

  it('quantidade acima do limite e nenhum tipo são recusados antes de pedir', async () => {
    await openNewDraft('?tipo=questoes');

    const count = screen.getByLabelText('Quantas questões');

    await userEvent.clear(count);
    await userEvent.type(count, '40');
    for (const name of [
      'Múltipla escolha',
      'Completar a lacuna',
      'Ordenar as palavras',
    ]) {
      await userEvent.click(screen.getByRole('button', { name }));
    }
    await submit();

    expect(await screen.findByText('Escolha a skill.')).toBeInTheDocument();
    expect(screen.getByText('Escolha ao menos um tipo.')).toBeInTheDocument();
    expect(screen.getByText(/20/)).toBeInTheDocument();
    expect(studioState.calls.draftRequests).toEqual([]);
  });
});

describe('Novo rascunho → notas de registro', () => {
  it('sem histórico de custo, e o pedido leva nível e quantidade', async () => {
    await openNewDraft('?tipo=notas');

    expect(await screen.findByTestId('cost-estimate')).toHaveTextContent(
      'Sem estimativa ainda',
    );

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A2');

    const count = screen.getByLabelText('Quantas notas');

    await userEvent.clear(count);
    await userEvent.type(count, '4');
    await submit();

    await waitFor(() =>
      expect(studioState.calls.draftRequests).toHaveLength(1),
    );
    expect(studioState.calls.draftRequests[0]).toMatchObject({
      kind: 'REGISTER_NOTES',
      body: { level: 'A2', count: 4 },
    });
  });

  it('a aba escolhida fica na URL', async () => {
    await openNewDraft();

    await userEvent.click(
      screen.getByRole('tab', { name: 'Notas de registro' }),
    );

    expect(
      await screen.findByRole('form', { name: 'Pedir notas de registro' }),
    ).toBeInTheDocument();
  });
});
