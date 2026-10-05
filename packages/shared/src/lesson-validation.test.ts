import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  lessonVersionMetaSchema,
  parseStep,
  sortSpans,
  validateSpans,
  validateSteps,
} from './index';

const MAYA = randomUUID();
const LUCAS = randomUUID();
const AUDIO = randomUUID();
const ITEM = randomUUID();

// ---------------------------------------------------------------------------
// Spans
// ---------------------------------------------------------------------------

describe('validateSpans', () => {
  const text = "I'm from Brazil";

  it('aceita marcação dentro do texto', () => {
    expect(
      validateSpans(text, [
        { start: 0, end: 3, kind: 'GRAMMAR', skillId: 'grammar.be' },
      ]),
    ).toEqual([]);
  });

  it('recusa marcação que passa do fim', () => {
    const issues = validateSpans(text, [{ start: 9, end: 99, kind: 'VOCAB' }]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('passa do fim');
  });

  it('recusa marcação em cima de espaço', () => {
    const issues = validateSpans(text, [{ start: 3, end: 4, kind: 'VOCAB' }]);

    expect(issues[0]?.message).toContain('espaço em branco');
  });

  it('recusa duas marcações sobrepostas', () => {
    const issues = validateSpans(text, [
      { start: 0, end: 8, kind: 'CHUNK', skillId: 'chunk.im-from' },
      { start: 4, end: 15, kind: 'VOCAB' },
    ]);

    expect(issues.some((issue) => issue.message.includes('sobrepõem'))).toBe(
      true,
    );
  });

  it('aceita marcações encostadas, sem sobrepor', () => {
    expect(
      validateSpans(text, [
        { start: 0, end: 3, kind: 'GRAMMAR', skillId: 'grammar.be' },
        { start: 4, end: 8, kind: 'VOCAB' },
      ]),
    ).toEqual([]);
  });

  it('ordena por início', () => {
    const ordered = sortSpans([
      { start: 4, end: 8, kind: 'VOCAB' },
      { start: 0, end: 3, kind: 'GRAMMAR', skillId: 'grammar.be' },
    ]);

    expect(ordered[0]?.start).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Conteúdo de etapa
// ---------------------------------------------------------------------------

function sceneStep(overrides: Record<string, unknown> = {}) {
  return {
    order: 0,
    type: 'SCENE' as const,
    content: {
      location: 'Corredor do prédio, em Austin',
      characterIds: [MAYA, LUCAS],
      lines: [
        {
          characterId: MAYA,
          text: 'Hi! Are you new here?',
          translation: 'Oi! Você é novo aqui?',
          audioAssetId: AUDIO,
          spans: [],
        },
      ],
      ...overrides,
    },
  };
}

describe('parseStep', () => {
  it('aceita uma cena completa', () => {
    const result = parseStep(sceneStep());

    expect(result.ok).toBe(true);
  });

  it('aceita fala com standardText quando a forma falada difere', () => {
    const result = parseStep(
      sceneStep({
        lines: [
          {
            characterId: MAYA,
            text: 'You coming?',
            standardText: 'Are you coming?',
            translation: 'Você vem?',
            spans: [
              {
                start: 0,
                end: 11,
                kind: 'REGISTER',
                registerNoteId: 'you-coming',
              },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);

    if (result.ok && result.step.type === 'SCENE') {
      expect(result.step.content.lines[0]?.standardText).toBe(
        'Are you coming?',
      );
    }
  });

  it('standardText é opcional quando a fala já é a forma padrão', () => {
    const result = parseStep(sceneStep());

    if (result.ok && result.step.type === 'SCENE') {
      expect(result.step.content.lines[0]?.standardText).toBeUndefined();
    } else {
      throw new Error('a cena deveria ter passado');
    }
  });

  it('recusa fala sem personagem', () => {
    const result = parseStep(
      sceneStep({
        lines: [{ text: 'Hi!', translation: 'Oi!', spans: [] }],
      }),
    );

    expect(result.ok).toBe(false);
  });

  it('recusa marcação REGISTER sem nota apontada', () => {
    const result = parseStep(
      sceneStep({
        lines: [
          {
            characterId: MAYA,
            text: 'You coming?',
            translation: 'Você vem?',
            spans: [{ start: 0, end: 11, kind: 'REGISTER' }],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
  });

  it('recusa prática sem item', () => {
    const result = parseStep({
      order: 0,
      type: 'PRACTICE',
      content: { itemIds: [] },
    });

    expect(result.ok).toBe(false);
  });

  it('recusa o mesmo item duas vezes na prática', () => {
    const result = parseStep({
      order: 0,
      type: 'PRACTICE',
      content: { itemIds: [ITEM, ITEM] },
    });

    expect(result.ok).toBe(false);
  });

  it('recusa roleplay com metas de id repetido', () => {
    const result = parseStep({
      order: 0,
      type: 'ROLEPLAY',
      content: {
        characterId: MAYA,
        scenario: 'No elevador do prédio',
        goals: [
          { id: 'name', description: 'Dizer o nome', skillIds: [] },
          { id: 'name', description: 'Dizer de onde é', skillIds: [] },
        ],
        maxTurns: 8,
        allowedVocabularyLevel: 'A1',
      },
    });

    expect(result.ok).toBe(false);
  });

  it('recusa tabela de card com linha torta', () => {
    const result = parseStep({
      order: 0,
      type: 'EXPLANATION_CARDS',
      content: {
        cards: [
          {
            title: 'Verbo to be',
            bodyMd: 'A forma muda com a pessoa.',
            table: { headers: ['Pessoa', 'Forma'], rows: [['I']] },
            examples: [],
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
  });

  it('recusa marcação que não cabe no texto do exemplo', () => {
    const result = parseStep({
      order: 0,
      type: 'EXPLANATION_CARDS',
      content: {
        cards: [
          {
            title: "I'm = I am",
            bodyMd: 'Na fala, quase sempre a forma curta.',
            examples: [
              {
                text: "I'm Lucas.",
                spans: [{ start: 0, end: 40, kind: 'GRAMMAR', skillId: 'g' }],
              },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
  });
});

describe('validateSteps', () => {
  it('recusa lição sem etapa', () => {
    const result = validateSteps([]);

    expect(result.ok).toBe(false);
  });

  it('recusa ordem com buraco', () => {
    const result = validateSteps([sceneStep(), { ...sceneStep(), order: 2 }]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(
        result.issues.some((issue) => issue.message.includes('pular número')),
      ).toBe(true);
    }
  });

  it('recusa duas etapas na mesma posição', () => {
    const result = validateSteps([sceneStep(), sceneStep()]);

    expect(result.ok).toBe(false);
  });

  it('junta os problemas de todas as etapas', () => {
    const result = validateSteps([
      { order: 0, type: 'PRACTICE', content: { itemIds: [] } },
      { order: 1, type: 'SUMMARY', content: { takeaways: [] } },
    ]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(new Set(result.issues.map((issue) => issue.order)).size).toBe(2);
    }
  });
});

describe('lessonVersionMetaSchema', () => {
  const valid = {
    title: 'Nice to meet you',
    objective: 'Apresentar-se e perguntar de onde a pessoa é',
    cefrLevel: 'A1' as const,
    estimatedMinutes: 12,
    targetSkillIds: ['grammar.be.present'],
  };

  it('aceita metadados válidos', () => {
    expect(lessonVersionMetaSchema.safeParse(valid).success).toBe(true);
  });

  it('recusa título curto, objetivo curto e minutos fora do limite', () => {
    const result = lessonVersionMetaSchema.safeParse({
      ...valid,
      title: 'a',
      objective: 'abc',
      estimatedMinutes: 500,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);

      expect(paths).toEqual(
        expect.arrayContaining(['title', 'objective', 'estimatedMinutes']),
      );
    }
  });

  it('recusa slug de skill inválido e mais de 20 skills', () => {
    expect(
      lessonVersionMetaSchema.safeParse({
        ...valid,
        targetSkillIds: ['Not A Slug'],
      }).success,
    ).toBe(false);
    expect(
      lessonVersionMetaSchema.safeParse({
        ...valid,
        targetSkillIds: Array.from(
          { length: 21 },
          (_, index) => `skill.n${String(index)}`,
        ),
      }).success,
    ).toBe(false);
  });
});

describe('mensagens em pt-BR', () => {
  function messagesFor(step: Parameters<typeof parseStep>[0]) {
    const result = parseStep(step);

    return result.ok
      ? []
      : result.issues.map((issue) => [issue.path, issue.message]);
  }

  it('campo que falta vira "Preencha este campo."', () => {
    expect(
      messagesFor({ order: 0, type: 'SCENE', content: { characterIds: [] } }),
    ).toEqual(
      expect.arrayContaining([
        ['location', 'Preencha este campo.'],
        ['characterIds', 'Adicione ao menos um item.'],
        ['lines', 'Preencha este campo.'],
      ]),
    );
  });

  it('texto curto, longo e id fora do formato', () => {
    const issues = messagesFor({
      order: 0,
      type: 'SCENE',
      content: {
        location: 'a',
        characterIds: ['nao-e-uuid'],
        lines: [
          {
            characterId: MAYA,
            text: 'x'.repeat(501),
            translation: '',
            spans: [],
          },
        ],
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        ['location', 'Escreva ao menos 2 caracteres.'],
        ['characterIds.0', 'Escolha uma opção da lista.'],
        ['lines.0.text', 'Use no máximo 500 caracteres.'],
        ['lines.0.translation', 'Preencha este campo.'],
      ]),
    );
  });

  it('o que o schema já escreve em pt-BR passa como está', () => {
    expect(
      messagesFor({
        order: 0,
        type: 'PRACTICE',
        content: { itemIds: [ITEM, ITEM] },
      }),
    ).toEqual([['itemIds', 'O mesmo item aparece duas vezes na prática.']]);
  });

  it('número fora do limite', () => {
    const issues = messagesFor({
      order: 0,
      type: 'ROLEPLAY',
      content: {
        characterId: MAYA,
        scenario: 'No elevador do prédio',
        goals: [{ id: 'g', description: 'Dizer o nome', skillIds: [] }],
        maxTurns: 99,
        allowedVocabularyLevel: 'A1',
      },
    });

    expect(issues).toEqual([['maxTurns', 'O máximo é 40.']]);
  });
});
