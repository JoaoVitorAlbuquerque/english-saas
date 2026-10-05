import { describe, expect, it } from 'vitest';

import {
  editorReducer,
  type EditorState,
  type EditorStep,
} from './editor-reducer';
import { emptyContent } from './step-content';
import {
  describePath,
  hasErrors,
  issuesAt,
  issuesUnder,
  path,
  validateEditor,
} from './validation';

const MAYA = '11111111-1111-4111-8111-111111111111';
const ITEM = '44444444-4444-4444-8444-444444444444';

function state(steps: EditorStep[], overrides = {}): EditorState {
  return {
    meta: {
      title: 'Nice to meet you',
      objective: 'Se apresentar e perguntar de onde a pessoa é.',
      cefrLevel: 'A1',
      estimatedMinutes: 10,
      targetSkillIds: ['grammar.be.present'],
      ...overrides,
    },
    steps,
  };
}

const validScene = (key = 's1'): EditorStep => ({
  key,
  type: 'SCENE',
  content: {
    location: 'Corredor do prédio',
    characterIds: [MAYA],
    lines: [
      {
        characterId: MAYA,
        text: "I'm Maya.",
        translation: 'Eu sou a Maya.',
        spans: [
          { start: 0, end: 3, kind: 'GRAMMAR', skillId: 'grammar.be.present' },
        ],
      },
    ],
  },
});

describe('validateEditor', () => {
  it('conteúdo válido: nenhum erro', () => {
    const validation = validateEditor(state([validScene()]));

    expect(validation.total).toBe(0);
    expect(hasErrors(validation)).toBe(false);
  });

  it('sem etapa, o erro é da lição inteira', () => {
    const validation = validateEditor(state([]));

    expect(validation.lesson).toEqual([
      'A lição precisa de ao menos uma etapa.',
    ]);
    expect(validation.total).toBe(1);
  });

  it('cada tipo de etapa recém-criada mostra os erros do schema, em pt-BR', () => {
    const types = [
      'SCENE',
      'EXPLANATION_CARDS',
      'PRACTICE',
      'FREE_PRODUCTION',
      'ROLEPLAY',
      'SUMMARY',
    ] as const;

    for (const type of types) {
      const step: EditorStep = {
        key: type,
        type,
        content: emptyContent(type),
      };
      const validation = validateEditor(state([step]));
      const issues = validation.steps[type] ?? [];

      expect(issues.length, type).toBeGreaterThan(0);
      for (const issue of issues) {
        // Nenhuma mensagem de zod em inglês.
        expect(issue.message, `${type} ${issue.path}`).not.toMatch(
          /expected|Invalid|Too (small|big)/,
        );
      }
    }
  });

  it('o erro cai no campo certo, pelo caminho dentro da etapa', () => {
    const scene = validScene();
    const broken: EditorStep = {
      ...scene,
      content: {
        ...scene.content,
        lines: [
          { characterId: MAYA, text: 'Hi!', translation: '', spans: [] },
          {
            characterId: '',
            text: "I'm Maya.",
            translation: 'Eu sou a Maya.',
            spans: [],
          },
        ],
      },
    };
    const issues = validateEditor(state([broken])).steps.s1;

    expect(issuesAt(issues, path('lines', 0, 'translation'))).toEqual([
      'Preencha este campo.',
    ]);
    expect(issuesAt(issues, path('lines', 1, 'characterId'))).toEqual([
      'Escolha uma opção da lista.',
    ]);
    expect(issuesAt(issues, path('lines', 0, 'text'))).toEqual([]);
  });

  it('marcação fora do texto e marcações sobrepostas aparecem no span', () => {
    const scene = validScene();
    const lineContent = (scene.content.lines as Record<string, unknown>[])[0];
    const step: EditorStep = {
      ...scene,
      content: {
        ...scene.content,
        lines: [
          {
            ...lineContent,
            spans: [
              { start: 0, end: 6, kind: 'VOCAB' },
              { start: 3, end: 40, kind: 'VOCAB' },
            ],
          },
        ],
      },
    };
    const issues = validateEditor(state([step])).steps.s1;

    expect(issuesAt(issues, 'lines.0.spans.1').join(' ')).toMatch(
      /passa do fim|sobrepõem/,
    );
    expect(issuesUnder(issues, 'lines.0').length).toBeGreaterThan(0);
    expect(issuesUnder(issues, 'lines.1')).toEqual([]);
  });

  it('metadados fora do limite aparecem no campo', () => {
    const validation = validateEditor(
      state([validScene()], {
        title: 'a',
        objective: 'abc',
        estimatedMinutes: 500,
        targetSkillIds: ['Not A Slug'],
      }),
    );

    expect(validation.meta.title).toBe('Escreva ao menos 2 caracteres.');
    expect(validation.meta.objective).toBe('Escreva ao menos 4 caracteres.');
    expect(validation.meta.estimatedMinutes).toBe('O máximo é 180.');
    expect(validation.meta.targetSkillIds).toBeDefined();
  });

  it('corrigir o campo limpa o erro', () => {
    let current = state([
      {
        key: 'p',
        type: 'PRACTICE',
        content: { itemIds: [], shuffle: false },
      },
    ]);

    expect(issuesAt(validateEditor(current).steps.p, 'itemIds')).toEqual([
      'Adicione ao menos um item.',
    ]);

    current = editorReducer(current, {
      type: 'step/content',
      key: 'p',
      content: { itemIds: [ITEM], shuffle: false },
    });

    expect(validateEditor(current).steps.p).toBeUndefined();
    expect(validateEditor(current).total).toBe(0);
  });

  it('erro de uma etapa não aparece em outra', () => {
    const validation = validateEditor(
      state([
        validScene('a'),
        { key: 'b', type: 'SUMMARY', content: { takeaways: [] } },
      ]),
    );

    expect(validation.steps.a).toBeUndefined();
    expect(validation.steps.b?.length).toBeGreaterThan(0);
  });
});

describe('describePath', () => {
  it('traduz o caminho para um texto que a pessoa entende', () => {
    expect(describePath('SCENE', 'lines.2.spans.0')).toBe(
      'fala 3 › marcação 1',
    );
    expect(describePath('SCENE', 'lines.0.translation')).toBe(
      'fala 1 › tradução',
    );
    expect(describePath('EXPLANATION_CARDS', 'cards.1.examples.0.text')).toBe(
      'card 2 › exemplo 1 › texto',
    );
    expect(describePath('PRACTICE', 'itemIds')).toBe('questões');
    expect(describePath('SCENE', '')).toBe('etapa');
  });
});
