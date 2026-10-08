import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { seedReadyLessonDraft, studioState } from '../../../mocks/studio-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

/** O editor da versão que a IA acabou de gerar: cena, cards, prática e o resto. */
async function openReview(painel = 'revisao') {
  const seeded = seedReadyLessonDraft();

  renderAdminAt(`/conteudo/versoes/${seeded.versionId}?painel=${painel}`);
  await screen.findByRole('heading', { name: 'Versão 1' });

  return seeded;
}

const side = () =>
  within(
    screen.getByRole('tabpanel', { name: /Revisão|Comentários|Áudio|Preview/ }),
  );
const stepList = () =>
  within(screen.getByRole('navigation', { name: 'Etapas da lição' }));
const versionOf = (id: string) =>
  mockState.versions.find((version) => version.id === id);

async function click(name: string | RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
}

function focusedField(): string | null {
  return (
    document.activeElement
      ?.closest('[data-field]')
      ?.getAttribute('data-field') ?? null
  );
}

describe('Revisão automática ao lado do editor', () => {
  it('mostra a estatística de nível, e os avisos por gravidade', async () => {
    await openReview();

    const panel = side();

    expect(
      await panel.findByRole('heading', { name: 'Revisão automática' }),
    ).toBeInTheDocument();

    const stats = panel.getByTestId('qa-level-stats');

    expect(stats).toHaveTextContent(
      '5,0% das palavras estão acima de A1 (7 de 140).',
    );
    expect(stats).toHaveTextContent('conhece 82,0% das palavras');
    expect(within(stats).getByText('neighbourhood · B1')).toBeInTheDocument();
    expect(within(stats).getByText('apartment · A2')).toBeInTheDocument();

    const blockers = panel.getByRole('region', { name: 'Bloqueadores' });

    expect(within(blockers).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(blockers).getByText(/não montam nenhuma das respostas aceitas/),
    ).toBeInTheDocument();
    expect(
      within(blockers).getByText(/2 lacuna\(s\) e 1 resposta\(s\)/),
    ).toBeInTheDocument();
    expect(
      within(panel.getByRole('region', { name: 'Avisos' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(4);
    expect(
      within(panel.getByRole('region', { name: 'Informações' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
    expect(panel.queryByText(/dá para aprovar/)).not.toBeInTheDocument();
  });

  it('a aba mostra quantos bloqueadores há', async () => {
    await openReview();

    const tab = await screen.findByRole('tab', { name: /Revisão/ });

    expect(tab).toHaveTextContent('2');
    expect(tab).toHaveTextContent('bloqueadores');
  });

  it('cada aviso de texto leva ao campo: caminho com e sem a posição da etapa', async () => {
    await openReview();

    const warnings = await side().findByRole('region', { name: 'Avisos' });
    const language = within(warnings)
      .getByText(/Soa pouco natural/)
      .closest('li') as HTMLElement;

    // `steps.0.lines.1`: a segunda fala da cena.
    expect(language).toHaveTextContent('Etapa 1 · Cena › fala 2');

    // Sai da etapa para provar que o clique leva de volta.
    await userEvent.click(stepList().getByRole('button', { name: /^4\./ }));
    await userEvent.click(
      within(language).getByRole('button', { name: 'Ir para o trecho' }),
    );

    await waitFor(() => expect(focusedField()).toBe('lines.1.text'));

    // `scene.lines.0.spans.0` (do mapeamento da IA): a primeira cena, fala 1.
    const mapping = within(warnings)
      .getByText(/não foi achado no texto/)
      .closest('li') as HTMLElement;

    await userEvent.click(stepList().getByRole('button', { name: /^4\./ }));
    await userEvent.click(
      within(mapping).getByRole('button', { name: 'Ir para o trecho' }),
    );

    await waitFor(() => expect(focusedField()).toBe('lines.0.text'));
  });

  it('o bloqueador de questão abre a questão certa, numa aba nova', async () => {
    await openReview();

    const blockers = await side().findByRole('region', {
      name: 'Bloqueadores',
    });
    const [first, second] = within(blockers).getAllByRole('link', {
      name: 'Abrir a questão',
    });
    const itemIds = (
      versionOf(mockState.versions.at(-1)?.id ?? '')?.steps.find(
        (step) => step.type === 'PRACTICE',
      )?.content as {
        itemIds: string[];
      }
    ).itemIds;

    expect(first).toHaveAttribute('href', `/conteudo/questoes/${itemIds[0]}`);
    expect(second).toHaveAttribute('href', `/conteudo/questoes/${itemIds[1]}`);
    expect(first).toHaveAttribute('target', '_blank');
    expect(first).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(
      within(blockers).getByText('Questão 1 da prática'),
    ).toBeInTheDocument();
  });

  it('avisos da lição inteira levam aos dados dela (nível e skills-alvo)', async () => {
    await openReview();

    const warnings = await side().findByRole('region', { name: 'Avisos' });

    await userEvent.click(
      within(
        within(warnings)
          .getByText(/acima de A1 \(teto/)
          .closest('li') as HTMLElement,
      ).getByRole('button', { name: 'Ir para os dados da lição' }),
    );

    await waitFor(() => expect(focusedField()).toBe('meta.cefrLevel'));

    await userEvent.click(
      within(
        within(warnings)
          .getByText(/nenhum item da prática mede ela/)
          .closest('li') as HTMLElement,
      ).getByRole('button', { name: 'Ir para os dados da lição' }),
    );

    await waitFor(() =>
      expect(focusedField()).toMatch(/^meta\.targetSkillIds/),
    );
  });

  it('versão que nunca passou pela revisão diz isso, e dá para rodar', async () => {
    const { versionId } = await openReview();

    // Já aberto com o relatório; recomeça sem ele.
    studioState.qa.delete(versionId);
    await userEvent.click(screen.getByRole('tab', { name: 'Comentários' }));
    await userEvent.click(screen.getByRole('tab', { name: /Revisão/ }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Rodar a revisão de novo' }),
    );

    expect(
      await side().findByRole('region', { name: 'Bloqueadores' }),
    ).toBeInTheDocument();
    expect(studioState.calls.qaRuns).toEqual([versionId]);
  });

  it('a revisão que ainda não rodou não finge um resultado', async () => {
    const seeded = seedReadyLessonDraft();

    studioState.qa.delete(seeded.versionId);
    renderAdminAt(`/conteudo/versoes/${seeded.versionId}?painel=revisao`);
    await screen.findByRole('heading', { name: 'Versão 1' });

    expect(
      await side().findByText(/ainda não rodou nesta versão/),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Revisão' })).not.toHaveTextContent(
      /\d/,
    );
  });

  it('erro ao rodar de novo aparece, e o relatório antigo continua', async () => {
    failNext('qa-run', {
      status: 502,
      code: 'AI_PROVIDER_UNAVAILABLE',
      message: 'O serviço de IA não respondeu.',
    });

    await openReview();
    await click('Rodar a revisão de novo');

    expect(await side().findByRole('alert')).toHaveTextContent(
      'O serviço de IA não respondeu.',
    );
    expect(
      side().getByRole('region', { name: 'Bloqueadores' }),
    ).toBeInTheDocument();
  });

  it('editar depois do relatório avisa que ele ficou desatualizado', async () => {
    await openReview();
    await side().findByRole('region', { name: 'Bloqueadores' });

    expect(side().queryByText(/Você editou depois desta revisão/)).toBeNull();

    await userEvent.click(stepList().getByRole('button', { name: /^1\./ }));
    await userEvent.type(
      screen.getByLabelText('Onde a cena acontece'),
      ' de manhã',
    );

    // O salvamento automático acontece 1,5 s depois de parar de digitar.
    expect(
      await side().findByText(/Você editou depois desta revisão/, undefined, {
        timeout: 5_000,
      }),
    ).toBeInTheDocument();
  });
});

describe('Aprovar com bloqueador', () => {
  async function inReview() {
    const seeded = await openReview();

    await click('Enviar para revisão');
    await waitFor(() =>
      expect(versionOf(seeded.versionId)?.status).toBe('IN_REVIEW'),
    );

    return seeded;
  }

  /** Corrige as duas questões com defeito, como se fosse no editor de questão. */
  function fixItems(versionId: string): void {
    const practice = versionOf(versionId)?.steps.find(
      (step) => step.type === 'PRACTICE',
    )?.content as { itemIds: string[] };

    for (const entry of mockState.items) {
      if (entry['id'] === practice.itemIds[0]) {
        entry['acceptedAnswers'] = ['I am Lucas'];
      }

      if (entry['id'] === practice.itemIds[1]) {
        entry['content'] = { sentence: 'She ___ from Austin.' };
      }
    }
  }

  it('o botão fica desabilitado, com a lista do que falta e o caminho para resolver', async () => {
    await inReview();

    const approve = await screen.findByRole('button', { name: 'Aprovar' });

    expect(approve).toBeDisabled();

    const note = await screen.findByText(
      'Não dá para aprovar: 2 bloqueador(es) na revisão automática.',
    );
    const box = note.closest('div') as HTMLElement;

    expect(
      within(box).getByText(/não montam nenhuma das respostas aceitas/),
    ).toBeInTheDocument();
    expect(
      within(box).getAllByRole('link', { name: 'Abrir a questão' }),
    ).toHaveLength(2);
    expect(within(box).getByText(/rode a revisão de novo/)).toBeInTheDocument();
    // Nenhuma tentativa de aprovar chegou ao servidor.
    expect(mockState.calls.transitions.map((call) => call.action)).toEqual([
      'submit-for-review',
    ]);
  });

  it('corrigir as questões e rodar de novo libera aprovar', async () => {
    const { versionId } = await inReview();

    await screen.findByText(/Não dá para aprovar/);
    fixItems(versionId);

    // Há dois botões iguais (a trava e a aba de revisão): qualquer um roda.
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Rodar a revisão de novo',
      })[0] as HTMLElement,
    );

    await waitFor(() =>
      expect(screen.queryByText(/Não dá para aprovar/)).not.toBeInTheDocument(),
    );
    expect(studioState.calls.qaRuns).toEqual([versionId]);
    expect(
      await side().findByText('Nenhum bloqueador: dá para aprovar.'),
    ).toBeInTheDocument();
    // Os avisos e a informação continuam: não travam.
    expect(side().getByRole('region', { name: 'Avisos' })).toBeInTheDocument();

    const approve = screen.getByRole('button', { name: 'Aprovar' });

    expect(approve).toBeEnabled();

    await userEvent.click(approve);

    await waitFor(() => expect(versionOf(versionId)?.status).toBe('APPROVED'));
    expect(await screen.findByText('Aprovado')).toBeInTheDocument();
  });

  it('a API recusar mesmo assim (relatório mais novo no servidor) mostra o painel de problemas', async () => {
    const seeded = await inReview();

    // O cliente achou que estava liberado; o servidor tinha um relatório novo.
    fixItems(seeded.versionId);
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Rodar a revisão de novo',
      })[0] as HTMLElement,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled(),
    );
    failNext('version-action:approve', {
      status: 409,
      code: 'QA_BLOCKERS',
      message: 'A revisão automática encontrou 1 problema(s).',
      details: {
        blockers: [
          {
            code: 'ITEM_WITHOUT_ANSWER',
            message: 'A questão não tem gabarito.',
            path: 'items.2',
          },
        ],
      },
    });
    await click('Aprovar');

    expect(
      await screen.findByText('A questão não tem gabarito.'),
    ).toBeInTheDocument();
    expect(versionOf(seeded.versionId)?.status).toBe('IN_REVIEW');
  });
});

describe('Comentários', () => {
  it('comenta a lição inteira, resolve, e os resolvidos aparecem sob pedido', async () => {
    await openReview('comentarios');

    expect(
      await screen.findByText('Nenhum comentário aberto.'),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText('Comentário'),
      'A cena ficou longa para o A1.',
    );
    await click('Comentar');

    const list = await screen.findByRole('list', { name: 'Comentários' });

    expect(
      within(list).getByText('A cena ficou longa para o A1.'),
    ).toBeInTheDocument();
    expect(within(list).getByText('A lição inteira')).toBeInTheDocument();
    expect(within(list).getByText(/Editora Teste/)).toBeInTheDocument();
    expect(studioState.calls.commentWrites[0]).toMatchObject({
      target: 'VERSION',
      body: 'A cena ficou longa para o A1.',
    });
    expect(screen.getByRole('tab', { name: /Comentários/ })).toHaveTextContent(
      '1',
    );

    await userEvent.click(
      within(list).getByRole('button', { name: 'Resolver' }),
    );

    expect(
      await screen.findByText('Nenhum comentário aberto.'),
    ).toBeInTheDocument();
    expect(studioState.calls.resolvedComments).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Mostrar os resolvidos' }),
    );

    const after = await screen.findByRole('list', { name: 'Comentários' });

    expect(within(after).getByText('Resolvido')).toBeInTheDocument();
    expect(
      within(after).queryByRole('button', { name: 'Resolver' }),
    ).not.toBeInTheDocument();
  });

  it('comentar a etapa: o botão da etapa abre a aba já com o alvo, e a etapa ganha o contador', async () => {
    await openReview();

    await userEvent.click(stepList().getByRole('button', { name: /^2\./ }));
    await click(/^Comentar esta etapa/);

    expect(
      await screen.findByRole('tab', { name: /Comentários/, selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Sobre')).toHaveDisplayValue(
      'Etapa 2 · Explicação',
    );

    await userEvent.type(
      screen.getByLabelText('Comentário'),
      'O card não explica o "I\'m".',
    );
    await click('Comentar');

    const list = await screen.findByRole('list', { name: 'Comentários' });

    expect(within(list).getByText('Etapa 2 · Explicação')).toBeInTheDocument();
    expect(studioState.calls.commentWrites[0]).toMatchObject({
      target: 'STEP',
      targetRef: '1',
    });
    // A lista de etapas mostra quantos comentários abertos a etapa tem.
    expect(stepList().getByRole('button', { name: /^2\./ })).toHaveTextContent(
      '1 com.',
    );
    expect(
      await screen.findByRole('button', {
        name: /Comentar esta etapa \(1 abertos\)/,
      }),
    ).toBeInTheDocument();
  });

  it('comentar uma questão da prática: o alvo é a questão, e o comentário mostra o enunciado', async () => {
    await openReview();

    await userEvent.click(stepList().getByRole('button', { name: /^3\./ }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Comentar a questão 1' }),
    );

    expect(await screen.findByLabelText('Sobre')).toHaveDisplayValue(
      'Questão 1 da prática',
    );

    await userEvent.type(
      screen.getByLabelText('Comentário'),
      'As peças não formam a frase.',
    );
    await click('Comentar');

    const list = await screen.findByRole('list', { name: 'Comentários' });

    expect(
      await within(list).findByText('Questão: Monte a frase.'),
    ).toBeInTheDocument();

    const practice = versionOf(mockState.versions.at(-1)?.id ?? '')?.steps.find(
      (step) => step.type === 'PRACTICE',
    )?.content as {
      itemIds: string[];
    };

    expect(studioState.calls.commentWrites[0]).toMatchObject({
      target: 'ITEM',
      targetRef: practice.itemIds[0],
    });
    // A linha da questão mostra o contador.
    await userEvent.click(stepList().getByRole('button', { name: /^3\./ }));
    expect(
      await screen.findByRole('button', { name: 'Comentar a questão 1' }),
    ).toHaveTextContent('1');
  });

  it('comentário vazio é recusado antes de ir ao servidor; erro do servidor aparece', async () => {
    await openReview('comentarios');
    await click('Comentar');

    expect(
      await screen.findByText('Escreva o comentário.'),
    ).toBeInTheDocument();
    expect(studioState.calls.commentWrites).toEqual([]);

    failNext('comment-add', {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Algo deu errado do nosso lado.',
    });
    await userEvent.type(screen.getByLabelText('Comentário'), 'Oi');
    await click('Comentar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Algo deu errado do nosso lado.',
    );
  });

  it('o problema de áudio não aparece na lista de comentários', async () => {
    const { versionId } = await openReview('comentarios');

    studioState.comments.push({
      id: 'c-audio',
      versionId,
      target: 'AUDIO',
      targetRef: 'scene:0:0',
      body: 'Soa seca.',
      audioIssue: 'INTONATION',
      resolvedAt: null,
      resolvedById: null,
      author: { id: 'user-1', name: 'Editora Teste' },
      createdAt: new Date().toISOString(),
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Comentários' }));

    expect(
      await screen.findByText('Nenhum comentário aberto.'),
    ).toBeInTheDocument();
  });
});
