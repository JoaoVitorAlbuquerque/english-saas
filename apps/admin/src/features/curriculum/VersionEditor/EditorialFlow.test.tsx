import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../test-helpers';

const DRAFT = 'version-2-1';

async function openEditor(versionId = DRAFT, heading = 'Versão 1') {
  renderAdminAt(`/conteudo/versoes/${versionId}`);
  await screen.findByRole('heading', { name: heading });
}

const panel = () =>
  within(document.getElementById('editor-panel') as HTMLElement);

/** A lista de etapas do editor — o preview tem botões de mesmo nome. */
const list = () =>
  within(screen.getByRole('navigation', { name: 'Etapas da lição' }));

function status(): string | undefined {
  return mockState.versions.find((v) => v.id === DRAFT)?.status;
}

async function click(name: string) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('Fluxo editorial no editor', () => {
  it('rascunho → revisão → aprovado → publicado → somente leitura', async () => {
    await openEditor();

    await click('Enviar para revisão');

    await waitFor(() => expect(status()).toBe('IN_REVIEW'));
    expect(
      await screen.findByText('Enviada para revisão.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Enviar para revisão' }),
    ).not.toBeInTheDocument();
    // Em revisão ainda se edita (e a edição devolve a rascunho): campos abertos.
    expect(panel().getByLabelText('Onde a cena acontece')).not.toHaveAttribute(
      'readonly',
    );

    await click('Aprovar');
    await waitFor(() => expect(status()).toBe('APPROVED'));
    expect(
      await screen.findByText(
        /Aprovada\. O áudio da lição começa a ser gerado/,
      ),
    ).toBeInTheDocument();

    await click('Publicar');

    // Publicar pede confirmação, com o número da versão.
    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByText(/A versão 1 passa a ser a que o aluno vê/),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Publicar' }),
    );

    await waitFor(() => expect(status()).toBe('PUBLISHED'));
    expect(
      await screen.findByText('Publicada. O aluno já vê esta versão.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /Esta versão está publicada e não pode ser editada/,
      ),
    ).toBeInTheDocument();
    expect(panel().getByLabelText('Onde a cena acontece')).toHaveAttribute(
      'readonly',
    );
    expect(mockState.calls.transitions.map((t) => t.action)).toEqual([
      'submit-for-review',
      'approve',
      'publish',
    ]);
    expect(
      mockState.lessons.find((l) => l.id === 'lesson-2')?.publishedVersionId,
    ).toBe(DRAFT);
  });

  it('cancelar a confirmação de publicar não publica', async () => {
    const draft = mockState.versions.find((v) => v.id === DRAFT);

    if (draft) {
      draft.status = 'APPROVED';
    }

    await openEditor();
    await click('Publicar');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );

    expect(mockState.calls.transitions).toEqual([]);
    expect(status()).toBe('APPROVED');
  });

  describe('enviar para revisão com conteúdo inválido', () => {
    async function openWithEmptyPractice() {
      await openEditor();
      await click('Adicionar etapa: Prática');
      await click('Enviar para revisão');
    }

    it('lista o que corrigir, por etapa, e leva ao campo', async () => {
      await openWithEmptyPractice();

      const alert = await screen.findByRole('alert');

      expect(
        within(alert).getByText('Corrija estes pontos e tente de novo:'),
      ).toBeInTheDocument();
      expect(within(alert).getByText('Etapa 4 · Prática')).toBeInTheDocument();
      expect(
        within(alert).getByText('Adicione ao menos um item.'),
      ).toBeInTheDocument();
      // O rascunho foi salvo antes de pedir a revisão, e a API recusou.
      expect(mockState.calls.stepSaves).toHaveLength(1);
      expect(status()).toBe('DRAFT');

      // Sai da etapa e volta pelo link do erro.
      await userEvent.click(list().getByRole('button', { name: /^1\. Cena/ }));
      await userEvent.click(
        within(alert).getByRole('button', { name: 'Ir para o campo' }),
      );

      expect(
        within(
          document.getElementById('editor-panel') as HTMLElement,
        ).getByText('Questões da prática'),
      ).toBeInTheDocument();
      expect(
        document
          .getElementById('editor-panel')
          ?.contains(document.activeElement),
      ).toBe(true);
    });

    it('corrigido o erro, o envio passa', async () => {
      await openWithEmptyPractice();
      await screen.findByRole('alert');

      await userEvent.click(
        await panel().findByRole('button', { name: 'Adicionar I ___ Maya.' }),
      );
      await click('Enviar para revisão');

      await waitFor(() => expect(status()).toBe('IN_REVIEW'));
      expect(
        await screen.findByText('Enviada para revisão.'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Não deu para continuar'),
      ).not.toBeInTheDocument();
    });
  });

  it('aprovar com bloqueio da revisão automática mostra os bloqueadores', async () => {
    const draft = mockState.versions.find((v) => v.id === DRAFT);

    if (draft) {
      draft.status = 'IN_REVIEW';
    }

    failNext('version-action:approve', {
      status: 409,
      code: 'QA_BLOCKERS',
      message: 'A revisão automática encontrou 2 problema(s).',
      details: {
        blockers: [
          {
            code: 'LEVEL_TOO_HIGH',
            message: 'O texto passa do nível A1.',
            path: null,
          },
          {
            code: 'MISSING_TRANSLATION',
            message: 'A fala 2 está sem tradução.',
            path: 'steps.0',
          },
        ],
      },
    });

    await openEditor();
    await click('Aprovar');

    const alert = await screen.findByRole('alert');

    expect(
      within(alert).getByText(/problemas que travam a aprovação/),
    ).toBeInTheDocument();
    expect(
      within(alert).getByText('O texto passa do nível A1.'),
    ).toBeInTheDocument();
    expect(
      within(alert).getByText('A fala 2 está sem tradução.'),
    ).toBeInTheDocument();
    expect(status()).toBe('IN_REVIEW');

    // Dispensar fecha o painel; tentar de novo aprova.
    await userEvent.click(
      within(alert).getByRole('button', { name: 'Dispensar' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await click('Aprovar');
    await waitFor(() => expect(status()).toBe('APPROVED'));
  });

  it('publicar sem áudio explica que ele é gerado na aprovação; de novo, publica', async () => {
    const draft = mockState.versions.find((v) => v.id === DRAFT);

    if (draft) {
      draft.status = 'APPROVED';
    }

    failNext('version-action:publish', {
      status: 409,
      code: 'MISSING_AUDIO',
      message: '2 trecho(s) ainda estão sem áudio.',
      details: { missing: ['scene:0:line:0', 'scene:0:line:1'] },
    });

    await openEditor();
    await click('Publicar');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Publicar',
      }),
    );

    const alert = await screen.findByRole('alert');

    expect(
      within(alert).getByText(
        'O áudio é gerado quando a versão é aprovada. Tente publicar de novo em instantes.',
      ),
    ).toBeInTheDocument();
    expect(
      within(alert).getByText(
        'Ainda sem áudio: scene:0:line:0, scene:0:line:1',
      ),
    ).toBeInTheDocument();
    expect(status()).toBe('APPROVED');
    // O diálogo fechou e o botão continua ali para tentar de novo.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await click('Publicar');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Publicar',
      }),
    );

    await waitFor(() => expect(status()).toBe('PUBLISHED'));
  });

  it('publicar com referência que sumiu lista o que falta, por tipo', async () => {
    const draft = mockState.versions.find((v) => v.id === DRAFT);

    if (draft) {
      draft.status = 'APPROVED';
    }

    failNext('version-action:publish', {
      status: 422,
      code: 'MISSING_REFERENCES',
      message: 'O conteúdo aponta para coisas que não existem.',
      details: {
        skills: ['grammar.sumiu'],
        items: ['44444444-4444-4444-8444-444444444444'],
        characters: [],
      },
    });

    await openEditor();
    await click('Publicar');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Publicar',
      }),
    );

    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('grammar.sumiu')).toBeInTheDocument();
    expect(within(alert).getByText(/Skills:/)).toBeInTheDocument();
    expect(within(alert).getByText(/Questões:/)).toBeInTheDocument();
    expect(within(alert).queryByText(/Personagens:/)).not.toBeInTheDocument();
  });

  it('devolver para rascunho e arquivar (com confirmação)', async () => {
    const draft = mockState.versions.find((v) => v.id === DRAFT);

    if (draft) {
      draft.status = 'IN_REVIEW';
    }

    await openEditor();
    await click('Devolver para rascunho');
    await waitFor(() => expect(status()).toBe('DRAFT'));
    expect(
      await screen.findByText('Devolvida para rascunho.'),
    ).toBeInTheDocument();
    // Devolver não é "voltou porque você editou": sem o aviso de edição.
    expect(screen.queryByText(/porque você a editou/)).not.toBeInTheDocument();

    await click('Arquivar');

    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByText('Arquivar esta versão?'),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Arquivar' }),
    );

    await waitFor(() => expect(status()).toBe('ARCHIVED'));
    expect(
      await screen.findByText(
        'Esta versão está arquivada e não pode ser editada.',
      ),
    ).toBeInTheDocument();
  });

  it('o envio salva antes: o que foi digitado vai junto, sem esperar o debounce', async () => {
    await openEditor();

    await userEvent.type(
      panel().getByLabelText('Onde a cena acontece'),
      ' (manhã)',
    );
    await click('Enviar para revisão');

    await waitFor(() => expect(status()).toBe('IN_REVIEW'));

    const saved = mockState.versions.find((v) => v.id === DRAFT);
    const scene = saved?.steps[0]?.content as { location: string };

    expect(scene.location).toBe('Corredor do prédio, em Austin (manhã)');
    // O salvamento veio antes da transição.
    expect(mockState.calls.stepSaves).toHaveLength(1);
  });

  describe('criar nova versão a partir da publicada', () => {
    it('abre um rascunho clonado e deixa a anterior no ar', async () => {
      await openEditor('version-1-2', 'Versão 2');
      await click('Criar nova versão');

      expect(
        await screen.findByRole('heading', { name: 'Versão 3' }),
      ).toBeInTheDocument();
      expect(
        mockState.lessons.find((l) => l.id === 'lesson-1')?.publishedVersionId,
      ).toBe('version-1-2');
      expect(mockState.versions.find((v) => v.version === 3)?.status).toBe(
        'DRAFT',
      );
    });

    it('já há versão aberta (corrida): mostra a mensagem da API', async () => {
      failNext('create-version', {
        status: 409,
        code: 'DRAFT_ALREADY_OPEN',
        message:
          'A versão 3 ainda está aberta. Publique ou arquive ela antes de começar outra.',
        details: { version: 3 },
      });

      await openEditor('version-1-2', 'Versão 2');
      await click('Criar nova versão');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A versão 3 ainda está aberta',
      );
    });
  });
});
