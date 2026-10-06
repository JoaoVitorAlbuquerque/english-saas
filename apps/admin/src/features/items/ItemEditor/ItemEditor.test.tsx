import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  ITEM_DICTATION_ID,
  ITEM_LISTEN_ID,
  mockState,
} from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../curriculum/test-helpers';

async function openNew() {
  renderAdminAt('/conteudo/questoes/nova');
  await screen.findByRole('heading', { name: 'Nova questão' });
}

async function openItem(id: string) {
  renderAdminAt(`/conteudo/questoes/${id}`);
  await screen.findByRole('heading', { name: 'Questão', level: 1 });
  await screen.findByLabelText('Enunciado');
}

const panel = () =>
  within(document.getElementById('item-editor-panel') as HTMLElement);
const preview = () => within(screen.getByTestId('item-preview'));
const creates = () =>
  mockState.calls.bankWrites.filter(
    (write) => write.resource === 'item' && write.action === 'create',
  );

async function save(name = 'Criar questão') {
  await userEvent.click(screen.getByRole('button', { name }));
}

async function pickSkill() {
  await userEvent.type(screen.getByLabelText(/Buscar skill/), 'Verbo to be');
  await userEvent.click(
    await screen.findByRole('button', { name: /Verbo to be no presente/ }),
  );
}

async function pickType(type: string) {
  await userEvent.selectOptions(screen.getByLabelText('Tipo de questão'), type);
}

/** Preenche o que todo tipo pede: enunciado, explicação e uma skill. */
async function fillCommon(prompt = 'Enunciado da questão.') {
  await userEvent.type(screen.getByLabelText('Enunciado'), prompt);
  await userEvent.type(
    screen.getByLabelText('Explicação'),
    'Explicação em português.',
  );
  await pickSkill();
}

describe('Banco → editor do item (novo)', () => {
  it('abre sem erros; ao tentar criar, aponta o que falta e leva o foco ao primeiro campo', async () => {
    await openNew();

    expect(
      screen.queryByText('Escreva ao menos 2 caracteres.'),
    ).not.toBeInTheDocument();

    await save();

    expect(
      (await screen.findAllByText('Escreva ao menos 2 caracteres.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/problema\(s\) a corrigir/)).toBeInTheDocument();
    expect(creates()).toEqual([]);
    await waitFor(() =>
      expect(screen.getByLabelText('Enunciado')).toHaveFocus(),
    );
  });

  it('cria uma múltipla escolha e abre a ficha da questão criada', async () => {
    await openNew();
    await fillCommon('I ___ a student.');

    const texts = panel().getAllByLabelText('Texto');

    await userEvent.type(texts[0] as HTMLElement, 'am');
    await userEvent.type(texts[1] as HTMLElement, 'is');
    await userEvent.click(
      panel().getAllByRole('checkbox', { name: 'Correta' })[0] as HTMLElement,
    );
    await save();

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toMatch(
        /^\/conteudo\/questoes\/[0-9a-f-]{36}$/,
      ),
    );
    expect(creates()).toHaveLength(1);
    expect(creates()[0]?.body).toMatchObject({
      type: 'MULTIPLE_CHOICE',
      prompt: 'I ___ a student.',
      explanation: 'Explicação em português.',
      cefrLevel: 'A1',
      difficulty: null,
      skillIds: ['grammar.be.present.affirmative'],
      acceptedAnswers: [],
      content: {
        options: [
          { id: 'a', text: 'am' },
          { id: 'b', text: 'is' },
        ],
        correctOptionIds: ['a'],
        shuffle: true,
      },
    });
    // Não vai slug nem discriminação vazios.
    expect(creates()[0]?.body).not.toHaveProperty('slug');
    expect(creates()[0]?.body).not.toHaveProperty('discrimination');

    // A ficha da questão criada: rascunho, com a opção de enviar para revisão.
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Enviar para revisão' }),
    ).toBeInTheDocument();
  });

  it('campo do conteúdo com erro: o aviso aparece no campo e some quando corrige', async () => {
    await openNew();
    await pickType('FILL_BLANK');
    await fillCommon();
    await userEvent.type(screen.getByLabelText('Frase'), 'Biscuit is a dog.');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'resposta aceita 1' }),
      'is',
    );
    await save();

    expect(
      await screen.findByText(
        'A frase precisa marcar a lacuna com ___ (três sublinhados).',
      ),
    ).toBeInTheDocument();
    expect(creates()).toEqual([]);

    await userEvent.clear(screen.getByLabelText('Frase'));
    await userEvent.type(screen.getByLabelText('Frase'), 'Biscuit ___ a dog.');

    expect(
      screen.queryByText(
        'A frase precisa marcar a lacuna com ___ (três sublinhados).',
      ),
    ).not.toBeInTheDocument();

    await save();
    await waitFor(() => expect(creates()).toHaveLength(1));
    expect(creates()[0]?.body).toMatchObject({
      type: 'FILL_BLANK',
      acceptedAnswers: ['is'],
      content: { sentence: 'Biscuit ___ a dog.' },
    });
  });

  it('ordenar palavras: peça em branco é apontada na peça', async () => {
    await openNew();
    await pickType('ORDER_WORDS');
    await fillCommon();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'resposta aceita 1' }),
      'I am Lucas',
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'peça 1' }), 'I');
    await save();

    // A peça 2 ficou em branco.
    const second = screen.getByRole('textbox', { name: 'peça 2' });

    expect(second).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByText('Preencha este campo.')).toBeInTheDocument();
    expect(creates()).toEqual([]);

    await userEvent.type(second, 'am');
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar peça' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'peça 3' }),
      'Lucas',
    );
    await save();

    await waitFor(() => expect(creates()).toHaveLength(1));
    expect(creates()[0]?.body).toMatchObject({
      content: { tokens: ['I', 'am', 'Lucas'] },
      acceptedAnswers: ['I am Lucas'],
    });
  });

  it('ligar pares: lado esquerdo repetido é recusado', async () => {
    await openNew();
    await pickType('MATCH');
    await fillCommon();

    const lefts = screen.getAllByLabelText('Lado esquerdo');
    const rights = screen.getAllByLabelText('Lado direito');

    await userEvent.type(lefts[0] as HTMLElement, 'cat');
    await userEvent.type(rights[0] as HTMLElement, 'gato');
    await userEvent.type(lefts[1] as HTMLElement, 'cat');
    await userEvent.type(rights[1] as HTMLElement, 'gata');
    await save();

    expect(
      await screen.findByText('O lado esquerdo tem itens repetidos.'),
    ).toBeInTheDocument();
    expect(creates()).toEqual([]);

    // O mapa de erros não se aplica a este tipo.
    expect(screen.getByText(/não usa o mapa de erros/)).toBeInTheDocument();
  });

  it('resposta digitada: respostas equivalentes são um problema só', async () => {
    await openNew();
    await pickType('TYPE_ANSWER');
    await fillCommon('Traduza: Ela é de Austin');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'resposta aceita 1' }),
      "She's from Austin",
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar variação' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'resposta aceita 2' }),
      'she is from austin.',
    );
    await save();

    expect(
      await screen.findByText(
        'Duas respostas aceitas são equivalentes — mantenha só uma.',
      ),
    ).toBeInTheDocument();
    expect(creates()).toEqual([]);
  });

  it('troca de nota de registro: sem a nota, o campo reclama', async () => {
    await openNew();
    await pickType('REGISTER_SWAP');
    await fillCommon('Passe para a forma padrão.');
    await userEvent.type(
      screen.getByLabelText('Frase de partida'),
      'gonna call',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'resposta aceita 1' }),
      'going to call',
    );
    await save();

    const select = screen.getByLabelText('Nota de registro');

    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(creates()).toEqual([]);

    await userEvent.selectOptions(select, 'gonna');
    await save();

    await waitFor(() => expect(creates()).toHaveLength(1));
    expect(creates()[0]?.body).toMatchObject({
      type: 'REGISTER_SWAP',
      content: {
        source: 'gonna call',
        direction: 'SPOKEN_TO_STANDARD',
        registerNoteId: 'gonna',
      },
    });
  });

  it('leitura: o texto curto demais é apontado no campo do texto', async () => {
    await openNew();
    await pickType('READING_COMPREHENSION');
    await fillCommon('Onde o Lucas mora?');
    await userEvent.type(screen.getByLabelText('Texto da leitura'), 'Curto.');
    await save();

    expect(
      (await screen.findAllByText('Escreva ao menos 20 caracteres.')).length,
    ).toBeGreaterThan(0);
    expect(creates()).toEqual([]);
  });

  describe('trocar o tipo', () => {
    it('em branco, troca sem perguntar', async () => {
      await openNew();
      await pickType('MATCH');

      expect(screen.getAllByLabelText('Lado esquerdo')).toHaveLength(2);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('com conteúdo escrito, pergunta; cancelar mantém, confirmar descarta', async () => {
      await openNew();
      await userEvent.type(
        panel().getAllByLabelText('Texto')[0] as HTMLElement,
        'am',
      );
      await pickType('MATCH');

      const dialog = await screen.findByRole('dialog');

      expect(
        within(dialog).getByText('Trocar o tipo da questão?'),
      ).toBeInTheDocument();

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancelar' }),
      );

      expect(screen.getByLabelText('Tipo de questão')).toHaveValue(
        'MULTIPLE_CHOICE',
      );
      expect(panel().getAllByLabelText('Texto')[0]).toHaveValue('am');

      await pickType('MATCH');
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Trocar o tipo',
        }),
      );

      expect(screen.getByLabelText('Tipo de questão')).toHaveValue('MATCH');
      expect(screen.getAllByLabelText('Lado esquerdo')).toHaveLength(2);
    });
  });
});

describe('Banco → editor do item (preview)', () => {
  it('só desenha quando o conteúdo passa no schema do tipo', async () => {
    await openNew();

    expect(
      screen.getByText(
        'Complete os campos obrigatórios do conteúdo para ver a questão desenhada.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('item-preview')).not.toBeInTheDocument();
  });

  it('acompanha a digitação, sem ir ao servidor', async () => {
    await openNew();
    await userEvent.type(
      screen.getByLabelText('Enunciado'),
      'I ___ a student.',
    );

    const texts = panel().getAllByLabelText('Texto');

    await userEvent.type(texts[0] as HTMLElement, 'am');
    await userEvent.type(texts[1] as HTMLElement, 'is');

    // Sem gabarito marcado o conteúdo ainda não passa no schema do tipo.
    expect(screen.queryByTestId('item-preview')).not.toBeInTheDocument();

    await userEvent.click(
      panel().getAllByRole('checkbox', { name: 'Correta' })[0] as HTMLElement,
    );

    expect(await screen.findByTestId('item-preview')).toBeInTheDocument();
    expect(preview().getByText('I ___ a student.')).toBeInTheDocument();
    expect(preview().getByText('am')).toBeInTheDocument();
    expect(preview().getByText('is')).toBeInTheDocument();

    await userEvent.type(texts[0] as HTMLElement, 'm');

    expect(await preview().findByText('amm')).toBeInTheDocument();
    expect(mockState.calls.previews).toEqual([]);
    expect(creates()).toEqual([]);
  });

  it('"Ver gabarito" mostra a resposta certa e a explicação, e dá para esconder', async () => {
    await openNew();
    await userEvent.type(
      screen.getByLabelText('Enunciado'),
      'I ___ a student.',
    );
    await userEvent.type(
      screen.getByLabelText('Explicação'),
      'Com "I", o verbo é "am".',
    );

    const texts = panel().getAllByLabelText('Texto');

    await userEvent.type(texts[0] as HTMLElement, 'am');
    await userEvent.type(texts[1] as HTMLElement, 'is');
    await userEvent.click(
      panel().getAllByRole('checkbox', { name: 'Correta' })[0] as HTMLElement,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver gabarito' }));

    expect(
      await preview().findByText('Com "I", o verbo é "am".'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Esconder o gabarito' }),
    );

    expect(
      preview().queryByText('Com "I", o verbo é "am".'),
    ).not.toBeInTheDocument();
  });

  it('o gabarito não vai na visão do aluno: responder não corrige nada', async () => {
    await openItem('44444444-4444-4444-8444-444444444444');

    await userEvent.click(preview().getByRole('radio', { name: /am/ }));

    expect(
      screen.getByText(/a resposta não é corrigida aqui/),
    ).toBeInTheDocument();
    expect(preview().queryByText('Certo')).not.toBeInTheDocument();
  });
});

describe('Banco → editor do item (áudio)', () => {
  it('item de escuta com áudio: toca; mudar o texto solta o áudio e o aviso aparece', async () => {
    await openItem(ITEM_LISTEN_ID);

    expect(
      screen.getByRole('button', { name: 'Ouvir o áudio da questão' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Com áudio')).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText('Texto que a voz fala'),
      ' Hello!',
    );

    expect(
      screen.queryByRole('button', { name: 'Ouvir o áudio da questão' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/Sem áudio ainda/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(
        mockState.calls.bankWrites.find((w) => w.action === 'update'),
      ).toBeDefined(),
    );

    const write = mockState.calls.bankWrites.find((w) => w.action === 'update');

    expect(write?.body).toMatchObject({
      content: { audioText: "I'm Maya. Hello!", audioAssetId: null },
    });
  });

  it('ditado sem áudio: avisa que ele nasce na aprovação da lição', async () => {
    await openItem(ITEM_DICTATION_ID);

    expect(
      screen.getByText(
        'Sem áudio ainda — ele é gerado quando a lição que usa a questão é aprovada.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Quantas vezes pode ouvir')).toHaveValue(3);
    expect(
      screen.getByText(
        'O áudio ainda não existe: ele é gerado quando a lição que usa a questão é aprovada.',
      ),
    ).toBeInTheDocument();
  });
});
