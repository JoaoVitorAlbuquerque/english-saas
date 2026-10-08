import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { seedReadyLessonDraft, studioState } from '../../../mocks/studio-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

const MAYA_LINE = "Hi! I'm Maya. Are you new here?";
const LUCAS_LINE = "Yes, I'm gonna live in 4B.";

const versionOf = (id: string) =>
  mockState.versions.find((version) => version.id === id);

/**
 * A versão gerada pela IA, já aprovada (pulando o ida e volta da revisão), com
 * a narração ainda na fila — ou pronta, se `narrated`.
 */
async function openApproved({
  narrated = false,
  status = 'APPROVED',
}: { narrated?: boolean; status?: 'APPROVED' | 'PUBLISHED' } = {}) {
  studioState.instantNarration = narrated;

  const seeded = seedReadyLessonDraft();
  const version = versionOf(seeded.versionId);

  if (version) {
    version.status = status;
    version.approvedAt = new Date().toISOString();
  }

  renderAdminAt(`/conteudo/versoes/${seeded.versionId}?painel=audio`);
  await screen.findByRole('heading', { name: 'Versão 1' });
  await screen.findByRole('heading', { name: 'Revisão de áudio' });

  return seeded;
}

const row = (text: string) =>
  screen.getByRole('listitem', {
    name: new RegExp(text.replace(/[.?]/g, '\\$&')),
  });

async function click(name: string | RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('Áudio antes da aprovação', () => {
  it('explica que ele nasce na aprovação', async () => {
    const { versionId } = seedReadyLessonDraft();

    renderAdminAt(`/conteudo/versoes/${versionId}?painel=audio`);

    expect(
      await screen.findByText(/O áudio é gerado quando a versão é aprovada/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('audio-progress')).not.toBeInTheDocument();
  });
});

describe('Revisão de áudio depois de aprovar', () => {
  it('lista as falas sem áudio e trava o publicar com a lista do que falta', async () => {
    await openApproved();

    expect(await screen.findByTestId('audio-progress')).toHaveTextContent(
      '0 de 2 com áudio',
    );
    expect(
      screen.getByText(
        'A narração está sendo gerada. A lista se atualiza sozinha.',
      ),
    ).toBeInTheDocument();
    expect(
      within(row(MAYA_LINE)).getByText('Sem áudio ainda'),
    ).toBeInTheDocument();
    expect(
      within(row(LUCAS_LINE)).getByText('Sem áudio ainda'),
    ).toBeInTheDocument();

    const publish = screen.getByRole('button', { name: 'Publicar' });

    expect(publish).toBeDisabled();

    const note = screen.getByText(
      'Não dá para publicar: 2 trecho(s) ainda sem áudio.',
    );
    const box = note.closest('div') as HTMLElement;

    expect(within(box).getByText(MAYA_LINE)).toBeInTheDocument();
    expect(within(box).getByText(LUCAS_LINE)).toBeInTheDocument();
    // Nenhuma tentativa de publicar chegou ao servidor.
    expect(mockState.calls.transitions).toEqual([]);
  });

  it('a narração chega, dá para ouvir cada fala e então publicar', async () => {
    const { versionId } = await openApproved();

    expect(await screen.findByTestId('audio-progress')).toHaveTextContent(
      '0 de 2',
    );

    await click('Atualizar agora');

    await waitFor(() =>
      expect(screen.getByTestId('audio-progress')).toHaveTextContent(
        '2 de 2 com áudio',
      ),
    );
    expect(
      within(row(MAYA_LINE)).getByRole('button', {
        name: `Ouvir: ${MAYA_LINE}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(row(LUCAS_LINE)).getByRole('button', {
        name: `Ouvir: ${LUCAS_LINE}`,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Não dá para publicar/)).not.toBeInTheDocument();

    const publish = screen.getByRole('button', { name: 'Publicar' });

    expect(publish).toBeEnabled();

    await userEvent.click(publish);
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Publicar',
      }),
    );

    await waitFor(() => expect(versionOf(versionId)?.status).toBe('PUBLISHED'));
    expect(await screen.findByText('Publicado')).toBeInTheDocument();
  });

  it('a lista se atualiza sozinha enquanto falta áudio', async () => {
    const { versionId } = await openApproved();

    expect(await screen.findByTestId('audio-progress')).toHaveTextContent(
      '0 de 2',
    );

    // O worker termina: a próxima leitura (a do polling) já vem completa.
    for (const entry of studioState.audio.get(versionId)?.values() ?? []) {
      entry.generated = true;
    }

    await waitFor(
      () =>
        expect(screen.getByTestId('audio-progress')).toHaveTextContent(
          '2 de 2',
        ),
      { timeout: 6_000 },
    );
  });

  it('marcar problema: tipo e observação viram um problema aberto na fala', async () => {
    await openApproved({ narrated: true });

    expect(await screen.findByTestId('audio-progress')).toHaveTextContent(
      '2 de 2',
    );

    await click(`Marcar problema: ${MAYA_LINE}`);

    const group = await screen.findByRole('group', {
      name: 'Marcar problema no áudio',
    });

    await userEvent.selectOptions(
      within(group).getByLabelText('O que está errado'),
      'INTONATION',
    );
    await userEvent.type(
      within(group).getByLabelText('Observação (opcional)'),
      'Soa como afirmação, é pergunta.',
    );
    await userEvent.click(
      within(group).getByRole('button', { name: 'Marcar' }),
    );

    const issues = await within(row(MAYA_LINE)).findByRole('list', {
      name: 'Problemas marcados',
    });

    expect(within(issues).getByText('Entonação')).toBeInTheDocument();
    expect(
      within(issues).getByText('Soa como afirmação, é pergunta.'),
    ).toBeInTheDocument();
    expect(studioState.calls.commentWrites[0]).toEqual({
      target: 'AUDIO',
      targetRef: 'scene:0:0',
      audioIssue: 'INTONATION',
      body: 'Soa como afirmação, é pergunta.',
    });
    expect(screen.getByRole('tab', { name: /Áudio/ })).toHaveTextContent('1');

    await userEvent.click(
      within(issues).getByRole('button', { name: 'Resolver' }),
    );

    await waitFor(() =>
      expect(
        within(row(MAYA_LINE)).queryByRole('list', {
          name: 'Problemas marcados',
        }),
      ).not.toBeInTheDocument(),
    );
    expect(studioState.calls.resolvedComments).toHaveLength(1);
  });

  it('o tipo do problema vale sozinho, sem observação', async () => {
    await openApproved({ narrated: true });
    await click(`Marcar problema: ${LUCAS_LINE}`);
    await userEvent.selectOptions(
      screen.getByLabelText('O que está errado'),
      'SPEED',
    );
    await click('Marcar');

    expect(
      await within(row(LUCAS_LINE)).findByText('Velocidade'),
    ).toBeInTheDocument();
    expect(studioState.calls.commentWrites[0]).toMatchObject({
      audioIssue: 'SPEED',
      body: '',
    });
  });

  it('pedir nova geração de uma fala', async () => {
    const { versionId } = await openApproved({ narrated: true });

    await screen.findByTestId('audio-progress');
    await userEvent.click(
      within(row(MAYA_LINE)).getByRole('button', {
        name: `Gerar de novo: ${MAYA_LINE}`,
      }),
    );

    await waitFor(() =>
      expect(studioState.calls.regenerations).toHaveLength(1),
    );
    expect(studioState.calls.regenerations[0]).toEqual({
      versionId,
      body: { keys: ['scene:0:0'] },
    });
    // O job termina e a fala volta com outro arquivo.
    await waitFor(() =>
      expect(studioState.audio.get(versionId)?.get('scene:0:0')?.revision).toBe(
        1,
      ),
    );
    expect(
      await screen.findByText('Gerando o áudio de novo.'),
    ).toBeInTheDocument();
  });

  it('as marcadas, mais devagar: a velocidade vai junto', async () => {
    const { versionId } = await openApproved({ narrated: true });

    await screen.findByTestId('audio-progress');

    const generate = screen.getByRole('button', {
      name: 'Gerar de novo as marcadas (0)',
    });

    expect(generate).toBeDisabled();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: `Marcar para gerar de novo: ${LUCAS_LINE}`,
      }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Velocidade da nova geração'),
      'slow',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Gerar de novo as marcadas (1)' }),
    );

    await waitFor(() =>
      expect(studioState.calls.regenerations).toHaveLength(1),
    );
    expect(studioState.calls.regenerations[0]).toEqual({
      versionId,
      body: { keys: ['scene:0:1'], speakingRate: 0.85 },
    });
    // A seleção é limpa depois de pedir.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Gerar de novo as marcadas (0)' }),
      ).toBeInTheDocument(),
    );
  });

  it('enquanto o job roda, os botões ficam em "Gerando…"', async () => {
    studioState.jobReads = 99;
    await openApproved({ narrated: true });

    await screen.findByTestId('audio-progress');
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: `Marcar para gerar de novo: ${MAYA_LINE}`,
      }),
    );
    await click('Gerar de novo as marcadas (1)');

    const busy = await screen.findByRole('button', { name: 'Gerando…' });

    expect(busy).toBeDisabled();
    expect(
      within(row(MAYA_LINE)).getByRole('button', {
        name: `Gerar de novo: ${MAYA_LINE}`,
      }),
    ).toBeDisabled();
  });

  it('o servidor recusar a nova geração aparece', async () => {
    failNext('audio-regenerate', {
      status: 409,
      code: 'AUDIO_REGENERATION_NOT_ALLOWED',
      message:
        'O áudio só pode ser gerado de novo depois que a versão for aprovada.',
    });

    await openApproved({ narrated: true });
    await screen.findByTestId('audio-progress');
    await userEvent.click(
      within(row(MAYA_LINE)).getByRole('button', {
        name: `Gerar de novo: ${MAYA_LINE}`,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'depois que a versão for aprovada',
    );
  });

  it('versão publicada: dá para ouvir e marcar, mas não gerar de novo', async () => {
    await openApproved({ narrated: true, status: 'PUBLISHED' });

    expect(
      await screen.findByRole('button', { name: `Ouvir: ${MAYA_LINE}` }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Gerar de novo/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Marcar problema: ${MAYA_LINE}` }),
    ).toBeInTheDocument();
  });
});
