import { ITEM_TYPES, type ItemType } from '@english-saas/shared';
import { describe, expect, it } from 'vitest';

import {
  blankContent,
  blankItemState,
  cleanContent,
  itemToState,
  newRowKey,
  nextOptionId,
  snapshotOf,
  toCreateRequest,
  toPatch,
  type ItemFormState,
} from './item-form';
import {
  contentIsRenderable,
  fieldPathOf,
  validateItemForm,
} from './item-validation';

const SKILL = 'grammar.be.present.affirmative';

/** Um formulário válido de cada tipo. */
const VALID: Record<ItemType, Partial<ItemFormState>> = {
  MULTIPLE_CHOICE: {
    content: {
      options: [
        { id: 'a', text: 'am' },
        { id: 'b', text: 'is' },
      ],
      correctOptionIds: ['a'],
      shuffle: true,
    },
  },
  LISTEN_CHOOSE: {
    content: {
      options: [
        { id: 'a', text: "I'm Maya." },
        { id: 'b', text: 'I am Lucas.' },
      ],
      correctOptionIds: ['a'],
      shuffle: true,
      audioText: "I'm Maya.",
      audioAssetId: null,
    },
  },
  ORDER_WORDS: {
    content: { tokens: ['I', 'am', 'Lucas'] },
    acceptedAnswers: ['I am Lucas'],
  },
  FILL_BLANK: {
    content: { sentence: 'I ___ Maya.' },
    acceptedAnswers: ['am'],
  },
  TYPE_ANSWER: {
    content: {},
    acceptedAnswers: ["She's from Austin"],
  },
  MATCH: {
    content: {
      pairs: [
        { left: 'cat', right: 'gato' },
        { left: 'dog', right: 'cachorro' },
      ],
    },
  },
  DICTATION: {
    content: {
      audioText: 'Nice to meet you.',
      audioAssetId: null,
      maxPlays: 0,
    },
    acceptedAnswers: ['Nice to meet you'],
  },
  READING_COMPREHENSION: {
    content: {
      passage: 'Lucas is from Brazil and lives in Austin.',
      spans: [],
      options: [
        { id: 'a', text: 'In Austin' },
        { id: 'b', text: 'In Brazil' },
      ],
      correctOptionIds: ['a'],
      shuffle: true,
    },
  },
  REGISTER_SWAP: {
    content: {
      source: "I'm gonna call you.",
      direction: 'SPOKEN_TO_STANDARD',
      registerNoteId: 'gonna',
    },
    acceptedAnswers: ["I'm going to call you"],
  },
};

function valid(type: ItemType, overrides: Partial<ItemFormState> = {}) {
  return {
    ...blankItemState(type),
    prompt: 'Enunciado da questão.',
    explanation: 'Explicação em português.',
    skillIds: [SKILL],
    ...VALID[type],
    ...overrides,
  } satisfies ItemFormState;
}

const paths = (state: ItemFormState) =>
  validateItemForm(state).map((issue) => issue.path);

describe('estado em branco', () => {
  it.each(ITEM_TYPES)('%s: conteúdo próprio do tipo', (type) => {
    expect(blankContent(type)).toBeDefined();
    expect(blankItemState(type).type).toBe(type);
  });

  it('só os tipos de resposta digitada começam com um campo de resposta aceita', () => {
    expect(blankItemState('FILL_BLANK').acceptedAnswers).toEqual(['']);
    expect(blankItemState('MULTIPLE_CHOICE').acceptedAnswers).toEqual([]);
    expect(blankItemState('MATCH').acceptedAnswers).toEqual([]);
  });

  it('múltipla escolha em branco aponta cada campo que falta, no caminho do campo', () => {
    expect(paths(blankItemState('MULTIPLE_CHOICE')).sort()).toEqual(
      [
        'prompt',
        'explanation',
        'skillIds',
        'content.options.0.text',
        'content.options.1.text',
        'content.correctOptionIds',
      ].sort(),
    );
  });
});

describe('validação do formulário', () => {
  it.each(ITEM_TYPES)('aceita um %s preenchido', (type) => {
    expect(validateItemForm(valid(type))).toEqual([]);
  });

  it('explica em pt-BR, no campo', () => {
    const issues = validateItemForm(valid('FILL_BLANK', { prompt: '' }));

    expect(issues).toContainEqual({
      path: 'prompt',
      message: 'Escreva ao menos 2 caracteres.',
    });
  });

  it('lacuna ausente em FILL_BLANK vai para o campo da frase', () => {
    const issues = validateItemForm(
      valid('FILL_BLANK', { content: { sentence: 'Biscuit is a dog.' } }),
    );

    expect(issues.map((issue) => issue.path)).toEqual(['content.sentence']);
  });

  it('gabarito sem alternativa correspondente', () => {
    const state = valid('MULTIPLE_CHOICE');
    const issues = validateItemForm({
      ...state,
      content: { ...state.content, correctOptionIds: ['z'] },
    });

    expect(issues).toEqual([
      {
        path: 'content.correctOptionIds',
        message: 'O gabarito aponta para uma alternativa que não existe.',
      },
    ]);
  });

  it('respostas aceitas equivalentes são um problema só, no campo das respostas', () => {
    const issues = validateItemForm(
      valid('TYPE_ANSWER', {
        acceptedAnswers: ["She's from Austin", 'she is from austin.'],
      }),
    );

    expect(issues).toEqual([
      {
        path: 'acceptedAnswers',
        message: 'Duas respostas aceitas são equivalentes — mantenha só uma.',
      },
    ]);
  });

  it('resposta aceita em branco aponta a linha', () => {
    const issues = validateItemForm(
      valid('ORDER_WORDS', { acceptedAnswers: ['I am Lucas', ''] }),
    );

    expect(issues.map((issue) => issue.path)).toContain('acceptedAnswers.1');
  });

  it('tipo de escolha não confere respostas aceitas (nem as manda)', () => {
    const state = valid('MULTIPLE_CHOICE', { acceptedAnswers: ['lixo'] });

    expect(validateItemForm(state)).toEqual([]);
    expect(toCreateRequest(state).acceptedAnswers).toEqual([]);
  });

  it('linha incompleta do mapa de erros aponta o que falta', () => {
    const base = valid('TYPE_ANSWER');
    const issues = validateItemForm({
      ...base,
      errorPatternMap: [
        { key: newRowKey(), wrong: 'She have from Austin', patternId: '' },
        { key: newRowKey(), wrong: '', patternId: 'l1.have-for-age' },
      ],
    });

    expect(issues).toEqual([
      {
        path: 'errorPatternMap.0',
        message: 'Escolha o erro típico que esta resposta revela.',
      },
      {
        path: 'errorPatternMap.1',
        message: 'Escreva a resposta errada que revela este erro.',
      },
    ]);
  });

  it('linha totalmente vazia do mapa é ignorada', () => {
    const issues = validateItemForm({
      ...valid('TYPE_ANSWER'),
      errorPatternMap: [{ key: newRowKey(), wrong: '', patternId: '' }],
    });

    expect(issues).toEqual([]);
  });

  it('dificuldade: vazio é o padrão do nível; fora da faixa ou texto, não', () => {
    expect(validateItemForm(valid('FILL_BLANK', { difficulty: '' }))).toEqual(
      [],
    );
    expect(
      validateItemForm(valid('FILL_BLANK', { difficulty: '1,5' })),
    ).toEqual([]);
    expect(paths(valid('FILL_BLANK', { difficulty: '5' }))).toEqual([
      'difficulty',
    ]);
    expect(paths(valid('FILL_BLANK', { difficulty: 'difícil' }))).toEqual([
      'difficulty',
    ]);
  });

  it('marcação fora do texto numa leitura vai para o campo das marcações', () => {
    const state = valid('READING_COMPREHENSION');
    const issues = validateItemForm({
      ...state,
      content: {
        ...state.content,
        spans: [{ start: 0, end: 500, kind: 'GRAMMAR', skillId: SKILL }],
      },
    });

    expect(issues.map((issue) => issue.path)).toEqual(['content.spans.0']);
  });
});

describe('fieldPathOf', () => {
  it('o conteúdo ganha o prefixo; respostas e mapa ficam como estão', () => {
    expect(fieldPathOf('options.0.text')).toBe('content.options.0.text');
    expect(fieldPathOf('sentence')).toBe('content.sentence');
    expect(fieldPathOf('content')).toBe('content');
    expect(fieldPathOf('acceptedAnswers')).toBe('acceptedAnswers');
    expect(fieldPathOf('acceptedAnswers.2')).toBe('acceptedAnswers.2');
    expect(fieldPathOf('errorPatternMap')).toBe('errorPatternMap');
  });
});

describe('preview', () => {
  it('só desenha conteúdo que passa no schema do tipo', () => {
    expect(contentIsRenderable(blankItemState('MULTIPLE_CHOICE'))).toBe(false);
    expect(contentIsRenderable(valid('MULTIPLE_CHOICE'))).toBe(true);
    // Falta a resposta aceita, mas o conteúdo desenha.
    expect(
      contentIsRenderable(valid('FILL_BLANK', { acceptedAnswers: [''] })),
    ).toBe(true);
  });
});

describe('corpo da API', () => {
  it('tira o opcional vazio, mantém o obrigatório', () => {
    expect(
      cleanContent('FILL_BLANK', {
        sentence: 'I ___ Maya.',
        hint: '',
        choices: [],
      }),
    ).toEqual({ sentence: 'I ___ Maya.' });
    expect(
      cleanContent('MULTIPLE_CHOICE', {
        options: [{ id: 'a', text: 'am', translation: '' }],
      }),
    ).toEqual({ options: [{ id: 'a', text: 'am' }] });
    expect(
      cleanContent('TYPE_ANSWER', { sourceText: '', hint: 'dica' }),
    ).toEqual({ hint: 'dica' });
  });

  it('criar manda dificuldade nula quando vazia (padrão do nível) e sem slug', () => {
    const body = toCreateRequest(valid('FILL_BLANK'));

    expect(body.difficulty).toBeNull();
    expect(body).not.toHaveProperty('slug');
    expect(body).not.toHaveProperty('discrimination');
    expect(body.errorPatternMap).toEqual({});
  });

  it('o próximo id de alternativa é o primeiro livre', () => {
    expect(nextOptionId([{ id: 'a' }, { id: 'b' }])).toBe(
      'a'.replace('a', 'c'),
    );
    expect(nextOptionId([{ id: 'a' }, { id: 'c' }])).toBe('b');
  });
});

describe('toPatch', () => {
  const saved: ItemFormState = valid('MULTIPLE_CHOICE', {
    difficulty: '-1.8',
    discrimination: '1',
    slug: 'a1-be',
  });

  it('não manda nada quando nada mudou', () => {
    expect(toPatch(saved, saved, false)).toEqual({});
  });

  it('manda só o que mudou, e não a dificuldade calibrada sem querer', () => {
    const patch = toPatch(
      { ...saved, explanation: 'Outra explicação.' },
      saved,
      false,
    );

    expect(patch).toEqual({ explanation: 'Outra explicação.' });
  });

  it('limpar a dificuldade manda null: volta ao padrão do nível', () => {
    expect(toPatch({ ...saved, difficulty: '' }, saved, false)).toEqual({
      difficulty: null,
    });
  });

  it('discriminação vazia não vai (a API não aceita null)', () => {
    expect(toPatch({ ...saved, discrimination: '' }, saved, false)).toEqual({});
  });

  it('com o item publicado, o que é congelado nunca vai', () => {
    const patch = toPatch(
      {
        ...saved,
        prompt: 'Enunciado novo.',
        explanation: 'Outra explicação.',
        cefrLevel: 'A2',
      },
      saved,
      true,
    );

    expect(patch).toEqual({
      explanation: 'Outra explicação.',
      cefrLevel: 'A2',
    });
  });

  it('o mapa de erros vai inteiro quando muda', () => {
    const patch = toPatch(
      {
        ...saved,
        errorPatternMap: [
          { key: newRowKey(), wrong: 'I is', patternId: 'l1.have-for-age' },
        ],
      },
      saved,
      false,
    );

    expect(patch).toEqual({ errorPatternMap: { 'I is': 'l1.have-for-age' } });
  });
});

describe('itemToState e snapshot', () => {
  const item = {
    id: 'item-1',
    slug: null,
    type: 'FILL_BLANK',
    prompt: 'I ___ Maya.',
    content: { sentence: 'I ___ Maya.' },
    acceptedAnswers: ['am'],
    explanation: 'Com "I", o verbo é "am".',
    errorPatternMap: { 'I is': 'l1.have-for-age' },
    cefrLevel: 'A1',
    skillIds: [SKILL],
    status: 'DRAFT',
    source: 'HUMAN',
    difficulty: -2,
    discrimination: 1,
    exposureCount: 0,
    correctRate: null,
    replacedById: null,
    replaces: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  } as const;

  it('o item salvo volta idêntico ao enviar de novo', () => {
    const state = itemToState(item as never);

    expect(state.difficulty).toBe('-2');
    expect(state.slug).toBe('');
    expect(toPatch(state, state, false)).toEqual({});
    expect(toCreateRequest(state)).toMatchObject({
      type: 'FILL_BLANK',
      acceptedAnswers: ['am'],
      errorPatternMap: { 'I is': 'l1.have-for-age' },
      difficulty: -2,
    });
  });

  it('a identidade local da linha do mapa não conta como alteração', () => {
    const a = itemToState(item as never);
    const b = itemToState(item as never);

    expect(a.errorPatternMap[0]?.key).not.toBe(b.errorPatternMap[0]?.key);
    expect(snapshotOf(a)).toBe(snapshotOf(b));
    expect(snapshotOf({ ...a, prompt: 'Outro.' })).not.toBe(snapshotOf(b));
  });
});
