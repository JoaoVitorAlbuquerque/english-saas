import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  LUCAS_ID,
  MAYA_ID,
  SKILL_BE,
  mockState,
} from '../../mocks/curriculum-mock';
import {
  UNIT_1_UUID,
  advanceDrafts,
  fixGeneratedItems,
  giveUuidsToContent,
  studioState,
} from '../../mocks/studio-mock';
import { renderAdminAt } from '../curriculum/test-helpers';

const MAYA_LINE = "Hi! I'm Maya. Are you new here?";

async function click(name: string | RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
}

/**
 * A história inteira do estúdio, do pedido à apostila: pedir o rascunho,
 * acompanhar na fila, revisar, resolver o bloqueador, aprovar, ouvir e
 * regerar o áudio, publicar.
 */
describe('Estúdio de conteúdo → do pedido à publicação', () => {
  it('pedir, acompanhar, resolver bloqueador, aprovar, revisar áudio e publicar', async () => {
    giveUuidsToContent();
    // A narração leva alguns instantes na fila, como no servidor.
    studioState.instantNarration = false;

    const unit = mockState.units.find((entry) => entry.id === UNIT_1_UUID);

    if (unit) {
      unit.castIds = [MAYA_ID, LUCAS_ID];
    }

    // --- 1. Pedir o rascunho -------------------------------------------
    renderAdminAt('/estudio/novo');
    await screen.findByRole('heading', { name: 'Estúdio de conteúdo' });
    expect(await screen.findByTestId('cost-estimate')).toHaveTextContent(
      '~US$ 0,0420',
    );

    await userEvent.selectOptions(screen.getByLabelText('Nível'), 'A1');
    await userEvent.selectOptions(
      await screen.findByLabelText('Unidade'),
      await screen.findByRole('option', { name: 'New neighbors' }),
    );
    await userEvent.type(
      screen.getByLabelText('Título (opcional)'),
      'At the airport',
    );
    await userEvent.type(
      screen.getByLabelText('Objetivo da lição'),
      'Fazer o check-in no aeroporto.',
    );
    await userEvent.type(screen.getByLabelText(/Buscar skill/), 'Verbo to be');
    await userEvent.click(
      await screen.findByRole('button', { name: /Verbo to be no presente/ }),
    );
    await click('Pedir rascunho');

    // --- 2. Acompanhar na fila -----------------------------------------
    const table = await screen.findByRole('table', {
      name: 'Rascunhos pedidos à IA',
    });
    const line = () =>
      within(table).getByRole('row', {
        name: /A1 · Fazer o check-in no aeroporto/,
      });

    expect(await within(line()).findByText('Na fila')).toBeInTheDocument();
    expect(studioState.calls.draftRequests[0]).toMatchObject({
      kind: 'LESSON',
      body: { slug: 'at-the-airport', targetSkillIds: [SKILL_BE] },
    });

    advanceDrafts(3);
    await click('Atualizar agora');

    expect(await within(line()).findByText('Pronto')).toBeInTheDocument();
    expect(within(line()).getByText('2 bloqueadores')).toBeInTheDocument();
    expect(within(line()).getByText('US$ 0,0435')).toBeInTheDocument();

    // --- 3. Abrir a revisão ---------------------------------------------
    await userEvent.click(
      within(line()).getByRole('link', { name: /^Revisar/ }),
    );
    await screen.findByRole('heading', { name: 'Versão 1' });

    const versionId = studioState.drafts[0]?.lessonVersionId as string;
    const statusOf = () =>
      mockState.versions.find((version) => version.id === versionId)?.status;
    const panel = () =>
      within(screen.getByRole('tabpanel', { name: /Revisão/ }));

    expect(
      await panel().findByRole('region', { name: 'Bloqueadores' }),
    ).toBeInTheDocument();

    // --- 4. Resolver o bloqueador ---------------------------------------
    await click('Enviar para revisão');
    await waitFor(() => expect(statusOf()).toBe('IN_REVIEW'));

    expect(
      await screen.findByRole('button', { name: 'Aprovar' }),
    ).toBeDisabled();
    expect(
      await screen.findByText(/Não dá para aprovar: 2 bloqueador/),
    ).toBeInTheDocument();

    fixGeneratedItems(versionId);
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Rodar a revisão de novo',
      })[0] as HTMLElement,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled(),
    );
    expect(screen.queryByText(/Não dá para aprovar/)).not.toBeInTheDocument();

    // --- 5. Aprovar -----------------------------------------------------
    await click('Aprovar');
    await waitFor(() => expect(statusOf()).toBe('APPROVED'));

    // O publicar espera a narração.
    await userEvent.click(screen.getByRole('tab', { name: /Áudio/ }));
    expect(await screen.findByTestId('audio-progress')).toHaveTextContent(
      '0 de 2 com áudio',
    );
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();
    expect(
      screen.getByText('Não dá para publicar: 2 trecho(s) ainda sem áudio.'),
    ).toBeInTheDocument();

    // --- 6. Revisar o áudio ---------------------------------------------
    await click('Atualizar agora');
    await waitFor(() =>
      expect(screen.getByTestId('audio-progress')).toHaveTextContent(
        '2 de 2 com áudio',
      ),
    );

    const maya = () => screen.getByRole('listitem', { name: /Maya: Hi!/ });

    expect(
      within(maya()).getByRole('button', { name: `Ouvir: ${MAYA_LINE}` }),
    ).toBeInTheDocument();

    await click(`Marcar problema: ${MAYA_LINE}`);
    await userEvent.selectOptions(
      screen.getByLabelText('O que está errado'),
      'PRONUNCIATION',
    );
    await userEvent.type(
      screen.getByLabelText('Observação (opcional)'),
      '"Maya" saiu com a sílaba errada.',
    );
    await click('Marcar');
    expect(await within(maya()).findByText('Pronúncia')).toBeInTheDocument();

    await userEvent.click(
      within(maya()).getByRole('button', {
        name: `Gerar de novo: ${MAYA_LINE}`,
      }),
    );
    await waitFor(() =>
      expect(studioState.audio.get(versionId)?.get('scene:0:0')?.revision).toBe(
        1,
      ),
    );

    // Ouviu a nova: o problema está resolvido.
    await userEvent.click(
      within(maya()).getByRole('button', { name: 'Resolver' }),
    );
    await waitFor(() =>
      expect(
        within(maya()).queryByRole('list', { name: 'Problemas marcados' }),
      ).not.toBeInTheDocument(),
    );

    // --- 7. Publicar ----------------------------------------------------
    const publish = screen.getByRole('button', { name: 'Publicar' });

    expect(publish).toBeEnabled();

    await userEvent.click(publish);
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Publicar',
      }),
    );
    await waitFor(() => expect(statusOf()).toBe('PUBLISHED'));

    // --- 8. A apostila da unidade acompanha ------------------------------
    await userEvent.click(screen.getByRole('link', { name: 'Estúdio IA' }));
    await userEvent.click(
      await screen.findByRole('link', { name: 'Apostilas' }),
    );

    const workbook = await screen.findByRole('row', { name: 'New neighbors' });

    expect(within(workbook).getByText('Em dia')).toBeInTheDocument();
  }, 30_000);
});
