import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  ITEM_AM_ID,
  ITEM_DICTATION_ID,
  ITEM_FILL_ID,
  ITEM_LISTEN_ID,
  ITEM_MATCH_ID,
  ITEM_ORDER_ID,
  ITEM_READING_ID,
  ITEM_SWAP_ID,
  ITEM_TYPE_ID,
  failNext,
  mockState,
} from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openItem(id: string) {
  renderAdminAt(`/conteudo/questoes/${id}`);
  await screen.findByRole('heading', { name: 'Questão', level: 1 });
  await screen.findByLabelText('Enunciado');
}

const panel = () =>
  within(document.getElementById('item-editor-panel') as HTMLElement);
const preview = () => within(screen.getByTestId('item-preview'));
const item = (id: string) => mockState.items.find((row) => row.id === id);
const writes = (action: string) =>
  mockState.calls.bankWrites.filter(
    (write) => write.resource === 'item' && write.action === action,
  );

async function click(name: string) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('Banco → editor do item (cada tipo)', () => {
  const CASES: [string, string, string][] = [
    ['múltipla escolha', ITEM_AM_ID, 'Com "I", o verbo é "am".'],
    ['completar a lacuna', ITEM_FILL_ID, 'Com "she", o verbo é "is".'],
    ['ligar pares', ITEM_MATCH_ID, 'Vocabulário de animais.'],
    ['resposta digitada', ITEM_TYPE_ID, 'Ela é = She is ou She’s.'],
    ['ordenar palavras', ITEM_ORDER_ID, 'Sujeito, verbo, nome.'],
    ['escuta e escolha', ITEM_LISTEN_ID, 'Ela se apresenta.'],
    ['ditado', ITEM_DICTATION_ID, 'Cumprimento comum.'],
    ['leitura', ITEM_READING_ID, 'O texto diz "lives in Austin".'],
    ['troca de registro', ITEM_SWAP_ID, 'gonna = going to.'],
  ];

  it.each(CASES)(
    '%s: o item carrega, o preview desenha e o gabarito mostra a explicação',
    async (_name, id, explanation) => {
      await openItem(id);

      expect(await screen.findByTestId('item-preview')).toBeInTheDocument();
      // O que o aluno vê não traz o gabarito.
      expect(preview().queryByText(explanation)).not.toBeInTheDocument();

      await click('Ver gabarito');

      expect(await preview().findByText(explanation)).toBeInTheDocument();
    },
  );

  it('item que já está salvo e não foi mexido não tem o que salvar', async () => {
    await openItem(ITEM_DICTATION_ID);

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(screen.getByText('Tudo salvo')).toBeInTheDocument();
  });
});

describe('Banco → editor do item (publicado)', () => {
  it('trava tipo, enunciado e conteúdo; a explicação continua editável', async () => {
    await openItem(ITEM_AM_ID);

    expect(screen.getByLabelText('Tipo de questão')).toBeDisabled();
    expect(screen.getByLabelText('Enunciado')).toHaveAttribute('readonly');
    expect(panel().getAllByLabelText('Texto')[0]).toHaveAttribute('readonly');
    expect(
      panel().getAllByRole('checkbox', { name: 'Correta' })[0],
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Adicionar alternativa' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Explicação')).not.toHaveAttribute('readonly');
    expect(screen.getByText(/Esta questão está publicada/)).toBeInTheDocument();
  });

  it('o botão vira "Criar nova versão do item"', async () => {
    await openItem(ITEM_AM_ID);

    expect(
      screen.getByRole('button', { name: 'Criar nova versão do item' }),
    ).toBeInTheDocument();
  });

  it('salvar a explicação manda só ela, e a questão segue publicada', async () => {
    await openItem(ITEM_AM_ID);

    await userEvent.clear(screen.getByLabelText('Explicação'));
    await userEvent.type(
      screen.getByLabelText('Explicação'),
      'Com "I", o verbo certo é "am".',
    );
    await click('Salvar');

    await waitFor(() => expect(writes('update')).toHaveLength(1));
    // Nem enunciado, nem conteúdo, nem a dificuldade calibrada.
    expect(writes('update')[0]?.body).toEqual({
      explanation: 'Com "I", o verbo certo é "am".',
    });
    expect(item(ITEM_AM_ID)?.status).toBe('PUBLISHED');
    expect(await screen.findByText(/Salvo às/)).toBeInTheDocument();
  });

  it('criar a nova versão abre o rascunho ligado ao original', async () => {
    await openItem(ITEM_AM_ID);
    await click('Criar nova versão do item');

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).not.toBe(
        `/conteudo/questoes/${ITEM_AM_ID}`,
      ),
    );

    // O rascunho novo: editável, ligado ao original.
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();
    expect(
      screen.getByText('Esta questão é a nova versão de outra.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Enunciado')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Enunciado')).toHaveValue('I ___ Maya.');

    const original = item(ITEM_AM_ID);
    const created = mockState.items.find((row) => row.replaces === ITEM_AM_ID);

    expect(created?.status).toBe('DRAFT');
    expect(original?.replacedById).toBe(created?.id);
    expect(original?.status).toBe('PUBLISHED');
  });

  it('com a nova versão já aberta, o original só aponta para ela', async () => {
    const revision = {
      ...(item(ITEM_AM_ID) as Record<string, unknown>),
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'DRAFT',
      replaces: ITEM_AM_ID,
      replacedById: null,
    };

    mockState.items.push(revision);
    (item(ITEM_AM_ID) as Record<string, unknown>).replacedById = revision.id;

    await openItem(ITEM_AM_ID);

    expect(
      screen.queryByRole('button', { name: 'Criar nova versão do item' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Já existe uma nova versão desta questão.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
      'href',
      `/conteudo/questoes/${revision.id}`,
    );
  });

  it('mandar o enunciado de item publicado é recusado pela API, com o aviso', async () => {
    await openItem(ITEM_AM_ID);
    // Força o caminho: a tela não manda o enunciado, mas o servidor decide.
    failNext('save-item', {
      status: 409,
      code: 'ITEM_IS_IMMUTABLE',
      message:
        'Este item já foi publicado. Para mudar o enunciado, crie uma nova versão dele.',
      details: { fields: ['prompt'] },
    });

    await userEvent.type(screen.getByLabelText('Explicação'), ' x');
    await click('Salvar');

    const alert = (await screen.findAllByRole('alert')).find((node) =>
      node.textContent?.includes('Este item já foi publicado.'),
    );

    expect(alert).toHaveTextContent('Campos que não mudam: Enunciado.');
  });
});

describe('Banco → editor do item (fluxo editorial)', () => {
  it('rascunho → revisão → aprovada → devolvida → publicada, com confirmação ao publicar', async () => {
    await openItem(ITEM_DICTATION_ID);

    await click('Enviar para revisão');
    await waitFor(() =>
      expect(item(ITEM_DICTATION_ID)?.status).toBe('IN_REVIEW'),
    );
    expect(await screen.findByText('Em revisão')).toBeInTheDocument();

    await click('Aprovar');
    await waitFor(() =>
      expect(item(ITEM_DICTATION_ID)?.status).toBe('APPROVED'),
    );

    await click('Devolver para rascunho');
    await waitFor(() => expect(item(ITEM_DICTATION_ID)?.status).toBe('DRAFT'));
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();

    await click('Enviar para revisão');
    await waitFor(() =>
      expect(item(ITEM_DICTATION_ID)?.status).toBe('IN_REVIEW'),
    );
    await click('Aprovar');
    await waitFor(() =>
      expect(item(ITEM_DICTATION_ID)?.status).toBe('APPROVED'),
    );

    // Publicar pede confirmação; cancelar não publica.
    await click('Publicar');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    expect(item(ITEM_DICTATION_ID)?.status).toBe('APPROVED');

    await click('Publicar');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Publicar',
      }),
    );

    await waitFor(() =>
      expect(item(ITEM_DICTATION_ID)?.status).toBe('PUBLISHED'),
    );
    // Agora é questão publicada: travada, com "criar nova versão".
    expect(
      await screen.findByRole('button', { name: 'Criar nova versão do item' }),
    ).toBeInTheDocument();
    expect(
      mockState.calls.bankWrites
        .filter((w) => w.resource === 'item')
        .map((w) => w.action),
    ).toEqual([
      'submit-for-review',
      'approve',
      'reject',
      'submit-for-review',
      'approve',
      'publish',
    ]);
  });

  it('editar uma questão aprovada devolve ela para rascunho e avisa', async () => {
    await openItem(ITEM_LISTEN_ID);

    expect(screen.getByText('Aprovado')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Explicação'), ' Mais.');
    await click('Salvar');

    expect(
      await screen.findByText(/voltou para rascunho porque você a editou/),
    ).toBeInTheDocument();
    expect(item(ITEM_LISTEN_ID)?.status).toBe('DRAFT');
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();
  });

  it('conteúdo inválido: enviar para revisão salva antes, e o que não passa para no campo', async () => {
    await openItem(ITEM_DICTATION_ID);

    await userEvent.clear(screen.getByLabelText('Texto que a voz fala'));
    await click('Enviar para revisão');

    expect(
      (await screen.findAllByText('Preencha este campo.')).length,
    ).toBeGreaterThan(0);
    expect(writes('submit-for-review')).toEqual([]);
    expect(writes('update')).toEqual([]);
    expect(item(ITEM_DICTATION_ID)?.status).toBe('DRAFT');
  });

  it('o que está digitado vai junto: salva e depois envia', async () => {
    await openItem(ITEM_DICTATION_ID);

    await userEvent.type(screen.getByLabelText('Explicação'), ' Fala comum.');
    await click('Enviar para revisão');

    await waitFor(() =>
      expect(item(ITEM_DICTATION_ID)?.status).toBe('IN_REVIEW'),
    );
    expect(
      mockState.calls.bankWrites
        .filter((w) => w.resource === 'item')
        .map((w) => w.action),
    ).toEqual(['update', 'submit-for-review']);
    expect(item(ITEM_DICTATION_ID)?.explanation).toBe(
      'Cumprimento comum. Fala comum.',
    );
  });

  it('a API recusando uma referência mostra o que falta, por tipo', async () => {
    failNext('item-action:submit-for-review', {
      status: 422,
      code: 'MISSING_REFERENCES',
      message: 'O conteúdo aponta para coisas que não existem.',
      details: { skills: ['grammar.sumiu'], registerNotes: [] },
    });
    await openItem(ITEM_DICTATION_ID);
    await click('Enviar para revisão');

    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('grammar.sumiu')).toBeInTheDocument();
    expect(within(alert).getByText('Skills:')).toBeInTheDocument();
    expect(item(ITEM_DICTATION_ID)?.status).toBe('DRAFT');

    await userEvent.click(
      within(alert).getByRole('button', { name: 'Dispensar' }),
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('arquivar pede confirmação; a questão em uso numa lição no ar não arquiva e explica onde', async () => {
    await openItem(ITEM_AM_ID);

    await click('Arquivar');

    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByText('Arquivar esta questão?'),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Arquivar' }),
    );

    const alert = (await screen.findAllByRole('alert')).find((node) =>
      node.textContent?.includes('está sendo usado por uma lição publicada'),
    ) as HTMLElement;

    expect(within(alert).getByText('nice-to-meet-you')).toBeInTheDocument();
    expect(item(ITEM_AM_ID)?.status).toBe('PUBLISHED');
  });

  it('arquivar um rascunho que ninguém usa', async () => {
    await openItem(ITEM_SWAP_ID);

    await click('Arquivar');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Arquivar',
      }),
    );

    await waitFor(() => expect(item(ITEM_SWAP_ID)?.status).toBe('ARCHIVED'));
    expect(await screen.findByText('Arquivado')).toBeInTheDocument();
    expect(screen.getByText(/Esta questão está arquivada/)).toBeInTheDocument();
  });
});

describe('Banco → editor do item (estatísticas)', () => {
  it('item problemático: alerta com as marcas, dificuldade inicial × atual e histórico', async () => {
    await openItem(ITEM_TYPE_ID);

    const alert = await screen.findByText('Item problemático');

    expect(alert).toBeInTheDocument();

    const box = alert.closest('[role="alert"]') as HTMLElement;

    expect(
      within(box).getByText('Difícil demais (menos de 10% acertam)'),
    ).toBeInTheDocument();
    expect(within(box).getByText('Discrimina mal')).toBeInTheDocument();

    expect(screen.getAllByText('80').length).toBeGreaterThan(0);
    expect(screen.getAllByText('7%').length).toBeGreaterThan(0);
    // 0,5 era a dificuldade inicial; a calibração levou a 0,9.
    expect(screen.getByText('+0,50')).toBeInTheDocument();
    expect(screen.getAllByText('+0,90').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/variou \+0,40 pela calibração/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Histórico de calibrações (2)'));

    const table = screen.getByRole('table', {
      name: 'Rodadas da calibração semanal deste item',
    });

    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('"Marcar como resolvido" tira o alerta, e a história fica', async () => {
    await openItem(ITEM_TYPE_ID);
    await screen.findByText('Item problemático');

    await click('Marcar como resolvido');

    await waitFor(() =>
      expect(screen.queryByText('Item problemático')).not.toBeInTheDocument(),
    );
    expect(mockState.calls.resolvedFlags).toEqual([ITEM_TYPE_ID]);
    expect(
      screen.getByText('Histórico de calibrações (2)'),
    ).toBeInTheDocument();
  });

  it('sem calibração: a atual é a inicial, e acerto sem dados diz o mínimo', async () => {
    await openItem(ITEM_FILL_ID);

    expect(
      await screen.findByText('ainda sem calibração: a atual é a inicial'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Poucos dados (menos de 10 respostas)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nunca calibrada')).toBeInTheDocument();
    expect(screen.queryByText('Item problemático')).not.toBeInTheDocument();
  });

  it('item novo ainda não tem estatística', async () => {
    renderAdminAt('/conteudo/questoes/nova');
    await screen.findByRole('heading', { name: 'Nova questão' });

    expect(
      screen.getByText(
        /As estatísticas aparecem quando a questão for publicada/,
      ),
    ).toBeInTheDocument();
  });

  it('mostra as lições no ar que usam a questão, com o link para a versão', async () => {
    await openItem(ITEM_AM_ID);

    const link = await screen.findByRole('link', { name: /\(versão 2\)/ });

    expect(link).toHaveAttribute('href', '/conteudo/versoes/version-1-2');
    expect(
      screen.getByText(/a lição continua apontando para a antiga/),
    ).toBeInTheDocument();
  });

  it('erro ao carregar as estatísticas deixa tentar de novo', async () => {
    // Erro 4xx não é repetido sozinho pelo cliente: a tela mostra de uma vez.
    failNext('item-stats', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Você não tem acesso a isto.',
    });
    await openItem(ITEM_FILL_ID);

    expect(
      await screen.findByText('Não conseguimos carregar as estatísticas.'),
    ).toBeInTheDocument();

    await click('Tentar de novo');

    expect(await screen.findByText('Nunca calibrada')).toBeInTheDocument();
  });
});
