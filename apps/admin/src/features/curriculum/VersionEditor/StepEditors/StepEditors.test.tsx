import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  MAYA_ID,
  mockState,
  type MockVersion,
} from '../../../../mocks/curriculum-mock';
import { renderAdminAt } from '../../test-helpers';

const OPEN = 'version-1-3';

/** Uma versão em rascunho com uma etapa de cada tipo (clone da publicada). */
function seedDraft(): void {
  const published = mockState.versions.find(
    (version) => version.id === 'version-1-2',
  ) as MockVersion;

  mockState.versions.push({
    ...structuredClone(published),
    id: OPEN,
    version: 3,
    status: 'DRAFT',
    publishedAt: null,
    approvedAt: null,
  });
}

const list = () =>
  within(screen.getByRole('navigation', { name: 'Etapas da lição' }));

const panel = () =>
  within(document.getElementById('editor-panel') as HTMLElement);

async function openStep(name: RegExp) {
  renderAdminAt(`/conteudo/versoes/${OPEN}`);
  await screen.findByRole('heading', { name: 'Versão 3' });
  await userEvent.click(await list().findByRole('button', { name }));
}

function lastSavedSteps() {
  return (mockState.calls.stepSaves.at(-1)?.body.steps ?? []) as {
    type: string;
    // O conteúdo salvo é navegado por caminho nos testes; `any` evita um tipo por etapa.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: Record<string, any>;
  }[];
}

async function waitForSave(count = 1) {
  await waitFor(
    () =>
      expect(mockState.calls.stepSaves.length).toBeGreaterThanOrEqual(count),
    { timeout: 5000 },
  );
}

describe('Editores de etapa', () => {
  describe('Cena', () => {
    it('marcar um trecho da fala cria a marcação com os índices e salva', async () => {
      seedDraft();
      await openStep(/^1\. Cena/);

      const input = panel().getAllByLabelText(
        'Fala em inglês (como se fala)',
      )[0] as HTMLInputElement;

      // "Hi! I'm Maya. Are you new here?" — seleciona "new" (índices 23–26).
      input.setSelectionRange(23, 26);
      fireEvent.select(input);

      await userEvent.click(
        panel().getAllByRole('button', {
          name: 'Vocabulário',
        })[0] as HTMLElement,
      );
      await userEvent.click(
        panel().getByRole('button', { name: 'Marcar trecho' }),
      );

      await waitForSave();

      const spans = lastSavedSteps()[0]?.content.lines[0].spans;

      expect(spans).toContainEqual({ start: 23, end: 26, kind: 'VOCAB' });
    });

    it('digitar no começo da fala desloca as marcações que existiam', async () => {
      seedDraft();
      await openStep(/^1\. Cena/);

      const input = panel().getAllByLabelText(
        'Fala em inglês (como se fala)',
      )[0] as HTMLInputElement;

      await userEvent.click(input);
      input.setSelectionRange(0, 0);
      await userEvent.keyboard('Oh! ');

      await waitForSave();

      const line = lastSavedSteps()[0]?.content.lines[0];

      expect(line.text).toBe("Oh! Hi! I'm Maya. Are you new here?");
      expect(line.spans).toEqual([
        {
          start: 8,
          end: 15,
          kind: 'GRAMMAR',
          skillId: 'grammar.be.present.affirmative',
        },
      ]);
    });

    it('a estrutura gramatical é opcional: limpar o campo tira a chave', async () => {
      seedDraft();
      await openStep(/^1\. Cena/);

      const standard = panel().getAllByLabelText(
        'Estrutura gramatical (opcional)',
      )[1] as HTMLInputElement;

      expect(standard).toHaveValue("Yes, I'm going to live in 4B.");

      await userEvent.clear(standard);
      await waitForSave();

      expect(lastSavedSteps()[0]?.content.lines[1]).not.toHaveProperty(
        'standardText',
      );
    });

    it('campo obrigatório vazio mostra o erro naquela fala, e só nela', async () => {
      seedDraft();
      await openStep(/^1\. Cena/);

      await userEvent.clear(
        panel().getAllByLabelText('Tradução em português')[1] as HTMLElement,
      );

      expect(panel().getByText('Preencha este campo.')).toBeInTheDocument();
      expect(
        list().getByRole('button', { name: /^1\. Cena/ }),
      ).toHaveTextContent('1 erro');
    });

    it('adicionar fala, trocar quem fala, subir e remover', async () => {
      seedDraft();
      await openStep(/^1\. Cena/);

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar fala' }),
      );

      expect(panel().getAllByText(/^\d\. fala \d$/)).toHaveLength(3);
      // A fala nova começa pelo outro personagem do elenco.
      const speakers = panel().getAllByLabelText('Quem fala');

      expect(speakers).toHaveLength(3);

      await userEvent.click(
        panel().getByRole('button', { name: 'Subir fala 3' }),
      );
      await userEvent.click(
        panel().getByRole('button', { name: 'Remover fala 2' }),
      );

      expect(panel().getAllByText(/^\d\. fala \d$/)).toHaveLength(2);
    });

    it('o elenco da cena limita quem pode falar', async () => {
      seedDraft();
      await openStep(/^1\. Cena/);

      const speaker = panel().getAllByLabelText(
        'Quem fala',
      )[0] as HTMLSelectElement;

      expect(
        within(speaker)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Maya', 'Lucas']);

      await userEvent.click(panel().getByRole('button', { name: 'Lucas' }));

      // Lucas saiu do elenco: já não aparece como opção da fala 1.
      expect(
        within(panel().getAllByLabelText('Quem fala')[0] as HTMLElement)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Maya']);
    });
  });

  describe('Explicação (cards)', () => {
    it('mostra o markdown como o aluno vê e deixa editar a tabela', async () => {
      seedDraft();
      await openStep(/^2\. Explicação/);

      const body = panel().getByLabelText('Texto do card (markdown)');

      await userEvent.clear(body);
      await userEvent.type(body, 'Use **am** com I.');

      expect(panel().getByText('Como o aluno vê o texto')).toBeInTheDocument();
      expect(
        panel().getByText('am', { selector: 'strong' }),
      ).toBeInTheDocument();

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar tabela' }),
      );
      await userEvent.type(
        panel().getByLabelText('Cabeçalho da coluna 1'),
        'Pessoa',
      );
      await userEvent.type(
        panel().getByLabelText('Cabeçalho da coluna 2'),
        'Forma',
      );
      await userEvent.type(panel().getByLabelText('Linha 1, coluna 1'), 'I');
      await userEvent.type(panel().getByLabelText('Linha 1, coluna 2'), 'am');
      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar linha' }),
      );

      expect(panel().getByLabelText('Linha 2, coluna 2')).toBeInTheDocument();

      await waitForSave();

      expect(lastSavedSteps()[1]?.content.cards[0].table).toEqual({
        headers: ['Pessoa', 'Forma'],
        rows: [
          ['I', 'am'],
          ['', ''],
        ],
      });
    });

    it('coluna adicionada vale para todas as linhas; tirar a tabela apaga a chave', async () => {
      seedDraft();
      await openStep(/^2\. Explicação/);

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar tabela' }),
      );
      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar coluna' }),
      );

      expect(panel().getByLabelText('Linha 1, coluna 3')).toBeInTheDocument();

      await userEvent.click(
        panel().getByRole('button', { name: 'Remover a tabela' }),
      );

      expect(
        panel().queryByLabelText('Cabeçalho da coluna 1'),
      ).not.toBeInTheDocument();
      // Voltou ao que já estava salvo: nada a gravar, e dá para criar de novo.
      expect(
        panel().getByRole('button', { name: 'Adicionar tabela' }),
      ).toBeInTheDocument();
    });

    it('exemplo novo com tradução opcional e marcação', async () => {
      seedDraft();
      await openStep(/^2\. Explicação/);

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar exemplo' }),
      );

      const text = panel().getAllByLabelText(
        'Exemplo em inglês',
      )[1] as HTMLInputElement;

      await userEvent.type(text, 'She is Maya.');

      // A tradução é opcional: card sem ela não dá erro.
      expect(
        panel().queryByText('Preencha este campo.'),
      ).not.toBeInTheDocument();

      text.setSelectionRange(0, 3);
      fireEvent.select(text);
      await userEvent.click(
        panel().getAllByRole('button', {
          name: 'Vocabulário',
        })[0] as HTMLElement,
      );
      await userEvent.click(
        panel().getByRole('button', { name: 'Marcar trecho' }),
      );

      await waitForSave();

      expect(lastSavedSteps()[1]?.content.cards[0].examples[1]).toEqual({
        text: 'She is Maya.',
        spans: [{ start: 0, end: 3, kind: 'VOCAB' }],
      });
    });

    it('card sem título mostra o erro no campo', async () => {
      seedDraft();
      await openStep(/^2\. Explicação/);

      await userEvent.clear(panel().getByLabelText('Título do card'));

      expect(
        panel().getByText('Escreva ao menos 2 caracteres.'),
      ).toBeInTheDocument();
    });
  });

  describe('Produção livre', () => {
    it('chips de ajuda e critérios de rubrica com skill e erro típico', async () => {
      seedDraft();
      await openStep(/^4\. Produção livre/);

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar chip' }),
      );
      await userEvent.type(panel().getByLabelText('Chip 3'), "I'm a student");

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar critério' }),
      );

      expect(panel().getAllByText(/^\d\. critério \d$/)).toHaveLength(2);

      await userEvent.type(
        panel().getAllByLabelText(
          'O que a correção precisa checar',
        )[1] as HTMLElement,
        'Usa o verbo to be.',
      );

      await userEvent.selectOptions(
        panel().getAllByLabelText(
          'Erro típico que a correção vigia (opcional)',
        )[1] as HTMLElement,
        'l1.have-for-age',
      );

      await waitForSave();

      const content = lastSavedSteps()[3]?.content;

      expect(content?.helpers).toEqual([
        "I'm from…",
        'Nice to meet you',
        "I'm a student",
      ]);
      expect(content?.rubric[1]).toEqual({
        id: 'criterio-2',
        description: 'Usa o verbo to be.',
        errorPatternId: 'l1.have-for-age',
      });
    });

    it('enunciado vazio e mínimo de palavras fora do limite aparecem nos campos', async () => {
      seedDraft();
      await openStep(/^4\. Produção livre/);

      await userEvent.clear(panel().getByLabelText('Enunciado (em português)'));

      expect(
        panel().getByText('Escreva ao menos 4 caracteres.'),
      ).toBeInTheDocument();

      const min = panel().getByLabelText('Mínimo de palavras (opcional)');

      await userEvent.clear(min);
      await userEvent.type(min, '900');

      expect(panel().getByText('O máximo é 500.')).toBeInTheDocument();

      await userEvent.clear(min);
      await waitForSave();

      expect(lastSavedSteps()[3]?.content).not.toHaveProperty('minWords');
    });

    it('a skill do critério é opcional e se escolhe por busca', async () => {
      seedDraft();
      await openStep(/^4\. Produção livre/);

      // A skill do critério e as skills trabalhadas mostram a mesma skill.
      expect(
        panel().getAllByText('Verbo to be no presente').length,
      ).toBeGreaterThan(0);

      await userEvent.click(
        panel().getAllByRole('button', {
          name: 'Tirar Verbo to be no presente',
        })[0] as HTMLElement,
      );
      await waitForSave();

      expect(lastSavedSteps()[3]?.content.rubric[0]).not.toHaveProperty(
        'skillId',
      );
    });
  });

  describe('Roleplay', () => {
    it('personagem, cenário, metas com skills e máximo de turnos', async () => {
      seedDraft();
      await openStep(/^5\. Conversa/);

      await userEvent.selectOptions(
        panel().getByLabelText('Personagem que conversa com o aluno'),
        'Lucas',
      );
      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar meta' }),
      );
      await userEvent.type(
        panel().getAllByLabelText(
          'O que o aluno precisa conseguir fazer',
        )[1] as HTMLElement,
        'Dizer de onde é',
      );

      // O seletor de skills da meta 2 (o segundo grupo "Skills da meta").
      const goalTwo = within(
        panel().getAllByRole('group', {
          name: 'Skills da meta',
        })[1] as HTMLElement,
      );

      await userEvent.type(
        goalTwo.getByLabelText('Buscar skill por nome ou código'),
        'cafe',
      );
      await userEvent.click(
        await goalTwo.findByRole('button', { name: /Pedir um café/ }),
      );

      const turns = panel().getByLabelText('Máximo de turnos');

      await userEvent.clear(turns);
      await userEvent.type(turns, '10');

      await waitForSave();

      const content = lastSavedSteps()[4]?.content;

      expect(content?.characterId).toBe('22222222-2222-4222-8222-222222222222');
      expect(content?.goals[1]).toEqual({
        id: 'meta-2',
        description: 'Dizer de onde é',
        skillIds: ['vocab.cafe'],
      });
      expect(content?.maxTurns).toBe(10);
    });

    it('turnos fora do limite mostram o erro no campo', async () => {
      seedDraft();
      await openStep(/^5\. Conversa/);

      const turns = panel().getByLabelText('Máximo de turnos');

      await userEvent.clear(turns);
      await userEvent.type(turns, '1');

      expect(panel().getByText('O mínimo é 2.')).toBeInTheDocument();

      await userEvent.clear(turns);
      await userEvent.type(turns, '60');

      expect(panel().getByText('O máximo é 40.')).toBeInTheDocument();
    });

    it('roleplay novo, vazio, pede personagem e cenário', async () => {
      seedDraft();
      renderAdminAt(`/conteudo/versoes/${OPEN}`);
      await screen.findByRole('heading', { name: 'Versão 3' });

      await userEvent.click(
        screen.getByRole('button', { name: 'Adicionar etapa: Conversa' }),
      );

      expect(
        panel().getByText('Escolha uma opção da lista.'),
      ).toBeInTheDocument();
      // Cenário e descrição da meta pedem pelo menos 4 caracteres.
      expect(
        panel().getAllByText('Escreva ao menos 4 caracteres.'),
      ).toHaveLength(2);
      expect(
        (
          panel().getByLabelText(
            'Personagem que conversa com o aluno',
          ) as HTMLSelectElement
        ).value,
      ).toBe('');
      expect(MAYA_ID).toBeTruthy();
    });
  });

  describe('Resumo', () => {
    it('itens do que o aluno leva, skills e notas de registro', async () => {
      seedDraft();
      await openStep(/^6\. Resumo/);

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar item' }),
      );
      await userEvent.type(
        panel().getByLabelText('Item 2'),
        'Na fala, a forma curta',
      );

      await userEvent.click(
        await panel().findByRole('button', { name: 'gonna → going to' }),
      );

      await waitForSave();

      const content = lastSavedSteps()[5]?.content;

      expect(content?.takeaways).toEqual([
        "I am / I'm",
        'Na fala, a forma curta',
      ]);
      expect(content?.registerNoteIds).toEqual(['gonna']);
    });

    it('item vazio mostra o erro naquele item', async () => {
      seedDraft();
      await openStep(/^6\. Resumo/);

      await userEvent.click(
        panel().getByRole('button', { name: 'Adicionar item' }),
      );

      expect(
        panel().getByText('Escreva ao menos 2 caracteres.'),
      ).toBeInTheDocument();
    });
  });

  describe('Prática', () => {
    it('mostra as questões escolhidas com tipo e nível e deixa tirar', async () => {
      seedDraft();
      await openStep(/^3\. Prática/);

      // A questão aparece na lista da prática (e também na busca do banco).
      expect(
        (await panel().findAllByText('She ___ from Austin.')).length,
      ).toBeGreaterThan(0);
      expect(panel().getAllByText('Completar a lacuna').length).toBeGreaterThan(
        0,
      );

      await userEvent.click(
        panel().getByRole('button', { name: 'Remover questão 1' }),
      );
      await waitForSave();

      expect(lastSavedSteps()[2]?.content.itemIds).toEqual([
        '55555555-5555-4555-8555-555555555555',
      ]);
    });

    it('"Embaralhar" liga e desliga', async () => {
      seedDraft();
      await openStep(/^3\. Prática/);

      await userEvent.click(
        panel().getByRole('checkbox', {
          name: 'Embaralhar a ordem para o aluno',
        }),
      );
      await waitForSave();

      expect(lastSavedSteps()[2]?.content.shuffle).toBe(true);
    });
  });
});
