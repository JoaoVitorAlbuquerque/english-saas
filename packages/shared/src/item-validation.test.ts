import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ITEM_TYPES,
  answerVariants,
  findErrorPattern,
  immutableFieldChanges,
  itemAuthoringPatchSchema,
  itemAuthoringSchema,
  matchesAnswer,
  normalizeAnswer,
  requiresNewItem,
  stripAnswerKey,
  toStudentItem,
  validateItem,
  type ItemType,
} from './index';

const ITEM = randomUUID();

const CHOICE = {
  options: [
    { id: 'a', text: 'am' },
    { id: 'b', text: 'is' },
  ],
  correctOptionIds: ['a'],
  shuffle: true,
};

// ---------------------------------------------------------------------------
// Normalização de resposta
// ---------------------------------------------------------------------------

describe('normalizeAnswer', () => {
  it('tira caixa, pontuação e espaço sobrando', () => {
    expect(normalizeAnswer('  Nice to MEET you!  ')).toBe('nice to meet you');
  });

  it('aceita aspa curva no lugar do apóstrofo', () => {
    expect(normalizeAnswer('She’s from Austin')).toBe(
      normalizeAnswer("She's from Austin"),
    );
  });

  it('trata hífen como separador', () => {
    expect(normalizeAnswer('twenty-one')).toBe('twenty one');
  });

  it('devolve string vazia para entrada só de pontuação', () => {
    expect(normalizeAnswer('!!!')).toBe('');
  });
});

describe('answerVariants', () => {
  it("gera as duas leituras de 's", () => {
    expect(answerVariants("she's")).toEqual(['she is', 'she has']);
  });

  it('não expande possessivo', () => {
    // `maya` não é pronome, então `maya's` continua inteiro.
    expect(answerVariants("Maya's dog")).toEqual(["maya's dog"]);
  });

  it('expande contração de uma leitura só', () => {
    expect(answerVariants("I'm Lucas")).toEqual(['i am lucas']);
  });

  it('não desmancha forma falada — é o que o REGISTER_SWAP mede', () => {
    expect(answerVariants("I'm gonna call you")).toEqual([
      'i am gonna call you',
    ]);
  });
});

describe('matchesAnswer', () => {
  it('casa contração com forma expandida', () => {
    expect(matchesAnswer("She's from Austin.", ['She is from Austin'])).toBe(
      true,
    );
  });

  it('casa a leitura com "has", não só com "is"', () => {
    expect(
      matchesAnswer("It's been a long day", ['It has been a long day']),
    ).toBe(true);
  });

  it('casa nos dois sentidos', () => {
    expect(matchesAnswer('She is from Austin', ["She's from Austin"])).toBe(
      true,
    );
  });

  it('recusa resposta diferente', () => {
    expect(matchesAnswer('He is from Austin', ["She's from Austin"])).toBe(
      false,
    );
  });

  it('recusa resposta vazia', () => {
    expect(matchesAnswer('   ', ['yes i am'])).toBe(false);
  });

  it('recusa quando não há gabarito', () => {
    expect(matchesAnswer('anything', [])).toBe(false);
  });

  it('separa "Yes, I am" de "Yes, I\'m"', () => {
    // Não são equivalentes em inglês, e a contração vira "i am" ao
    // normalizar — então este par casa, e o item precisa ser de escolha.
    expect(matchesAnswer("Yes, I'm", ['Yes, I am'])).toBe(true);
  });
});

describe('findErrorPattern', () => {
  const map = {
    'I have 20 years': 'l1.have-for-age',
    'Is raining': 'l1.missing-subject',
  };

  it('reconhece o erro mesmo com caixa e pontuação diferentes', () => {
    expect(findErrorPattern('i have 20 years.', map)).toBe('l1.have-for-age');
  });

  it('devolve undefined quando nada casa', () => {
    expect(findErrorPattern("I'm 20 years old", map)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateItem
// ---------------------------------------------------------------------------

/** Um item válido de cada tipo — a base dos testes que quebram um campo. */
const VALID: Record<ItemType, { content: unknown; acceptedAnswers: string[] }> =
  {
    MULTIPLE_CHOICE: { content: CHOICE, acceptedAnswers: [] },
    LISTEN_CHOOSE: {
      content: { ...CHOICE, audioText: 'I am Maya.', audioAssetId: null },
      acceptedAnswers: [],
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
      content: { sourceText: 'Ela é de Austin' },
      acceptedAnswers: ["She's from Austin"],
    },
    MATCH: {
      content: {
        pairs: [
          { left: 'I', right: 'am' },
          { left: 'he', right: 'is' },
        ],
      },
      acceptedAnswers: [],
    },
    DICTATION: {
      content: { audioText: 'Nice to meet you.', audioAssetId: null },
      acceptedAnswers: ['Nice to meet you'],
    },
    READING_COMPREHENSION: {
      content: {
        passage: 'Lucas is from Brazil and lives in Austin.',
        spans: [],
        ...CHOICE,
      },
      acceptedAnswers: [],
    },
    REGISTER_SWAP: {
      content: {
        source: "I'm gonna call you.",
        direction: 'SPOKEN_TO_STANDARD',
        registerNoteId: 'register.gonna',
      },
      acceptedAnswers: ["I'm going to call you"],
    },
  };

describe('validateItem', () => {
  it.each(ITEM_TYPES)('aceita um %s válido', (type) => {
    expect(validateItem({ type, ...VALID[type] })).toEqual([]);
  });

  it('recusa gabarito apontando para alternativa inexistente', () => {
    const issues = validateItem({
      type: 'MULTIPLE_CHOICE',
      content: { ...CHOICE, correctOptionIds: ['z'] },
      acceptedAnswers: [],
    });

    expect(issues).toEqual([
      {
        path: 'correctOptionIds',
        message: 'O gabarito aponta para uma alternativa que não existe.',
      },
    ]);
  });

  it('recusa duas alternativas com o mesmo id', () => {
    const issues = validateItem({
      type: 'MULTIPLE_CHOICE',
      content: {
        ...CHOICE,
        options: [
          { id: 'a', text: 'am' },
          { id: 'a', text: 'is' },
        ],
      },
      acceptedAnswers: [],
    });

    expect(issues).toEqual([
      { path: 'options', message: 'Duas alternativas têm o mesmo id.' },
    ]);
  });

  it('exige acceptedAnswers em tipo digitado', () => {
    const issues = validateItem({
      type: 'ORDER_WORDS',
      content: { tokens: ['I', 'am', 'Lucas'] },
      acceptedAnswers: [],
    });

    expect(issues.some((issue) => issue.path === 'acceptedAnswers')).toBe(true);
  });

  it('recusa acceptedAnswers em tipo de escolha', () => {
    const issues = validateItem({
      type: 'MULTIPLE_CHOICE',
      content: CHOICE,
      acceptedAnswers: ['am'],
    });

    expect(issues.some((issue) => issue.path === 'acceptedAnswers')).toBe(true);
  });

  it('recusa duas respostas aceitas que são a mesma coisa', () => {
    const issues = validateItem({
      type: 'TYPE_ANSWER',
      content: {},
      acceptedAnswers: ["She's from Austin", 'she is from austin.'],
    });

    expect(issues.some((issue) => issue.message.includes('equivalentes'))).toBe(
      true,
    );
  });

  it('recusa resposta aceita que só tem pontuação', () => {
    const issues = validateItem({
      type: 'TYPE_ANSWER',
      content: {},
      acceptedAnswers: ['!!!'],
    });

    expect(issues.some((issue) => issue.message.includes('ficou vazia'))).toBe(
      true,
    );
  });

  it('exige a lacuna marcada em FILL_BLANK, no campo da frase', () => {
    const issues = validateItem({
      type: 'FILL_BLANK',
      content: { sentence: 'Biscuit is a dog.' },
      acceptedAnswers: ['is'],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('sentence');
  });

  it('recusa lados esquerdos repetidos em MATCH', () => {
    const issues = validateItem({
      type: 'MATCH',
      content: {
        pairs: [
          { left: 'I', right: 'am' },
          { left: 'I', right: 'is' },
        ],
      },
      acceptedAnswers: [],
    });

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.path).toBe('pairs');
  });

  it('recusa REGISTER_SWAP sem a nota de registro', () => {
    const issues = validateItem({
      type: 'REGISTER_SWAP',
      content: { source: 'gonna', direction: 'SPOKEN_TO_STANDARD' },
      acceptedAnswers: ['going to'],
    });

    expect(issues.some((issue) => issue.path === 'registerNoteId')).toBe(true);
  });

  it('recusa marcação fora do texto em READING_COMPREHENSION', () => {
    const issues = validateItem({
      type: 'READING_COMPREHENSION',
      content: {
        ...CHOICE,
        passage: 'Lucas is from Brazil and lives in Austin.',
        spans: [
          {
            start: 30,
            end: 400,
            kind: 'GRAMMAR',
            skillId: 'grammar.be.present.affirmative',
          },
        ],
      },
      acceptedAnswers: [],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('spans.0');
  });

  it('recusa chave vazia no mapa de erros', () => {
    const issues = validateItem({
      type: 'TYPE_ANSWER',
      content: {},
      acceptedAnswers: ['yes'],
      errorPatternMap: { '...': 'l1.have-for-age' },
    });

    expect(issues).toEqual([
      {
        path: 'errorPatternMap',
        message: 'Uma chave do mapa de erros ficou vazia depois de normalizar.',
      },
    ]);
  });

  it('escreve em pt-BR os limites que o zod escreveria em inglês', () => {
    const issues = validateItem({
      type: 'MULTIPLE_CHOICE',
      content: { ...CHOICE, options: [{ id: 'a', text: 'am' }] },
      acceptedAnswers: [],
    });

    expect(issues[0]).toEqual({
      path: 'options',
      message: 'Adicione ao menos 2 itens.',
    });
  });

  it('aponta o campo certo dentro de uma alternativa', () => {
    const issues = validateItem({
      type: 'MULTIPLE_CHOICE',
      content: {
        ...CHOICE,
        options: [
          { id: 'a', text: '' },
          { id: 'b', text: 'is' },
        ],
      },
      acceptedAnswers: [],
    });

    expect(issues).toEqual([
      { path: 'options.0.text', message: 'Preencha este campo.' },
    ]);
  });

  it('não lança com conteúdo que nem é objeto', () => {
    expect(
      validateItem({ type: 'MATCH', content: null, acceptedAnswers: [] })
        .length,
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Campos do item
// ---------------------------------------------------------------------------

describe('itemAuthoringSchema', () => {
  const valid = {
    type: 'MULTIPLE_CHOICE',
    prompt: 'I ___ Maya.',
    content: CHOICE,
    explanation: 'Com "I", o verbo é "am".',
    cefrLevel: 'A1',
    skillIds: ['grammar.be.present.affirmative'],
  };

  it('aceita o mínimo', () => {
    expect(itemAuthoringSchema.safeParse(valid).success).toBe(true);
  });

  it('exige ao menos uma skill', () => {
    expect(
      itemAuthoringSchema.safeParse({ ...valid, skillIds: [] }).success,
    ).toBe(false);
  });

  it('prende a dificuldade na faixa e aceita null (padrão do nível)', () => {
    expect(
      itemAuthoringSchema.safeParse({ ...valid, difficulty: 5 }).success,
    ).toBe(false);
    expect(
      itemAuthoringSchema.safeParse({ ...valid, difficulty: null }).success,
    ).toBe(true);
  });

  it('limita a chave do mapa de erros a 300 caracteres', () => {
    expect(
      itemAuthoringSchema.safeParse({
        ...valid,
        errorPatternMap: { [`${'x'.repeat(301)}`]: 'l1.have-for-age' },
      }).success,
    ).toBe(false);
  });

  it('no PATCH todo campo é opcional', () => {
    expect(itemAuthoringPatchSchema.safeParse({}).success).toBe(true);
    expect(
      itemAuthoringPatchSchema.safeParse({ explanation: 'x' }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Imutabilidade
// ---------------------------------------------------------------------------

describe('imutabilidade do item', () => {
  const current = {
    type: 'TYPE_ANSWER' as const,
    prompt: 'Traduza: Ela é de Austin',
    content: { hint: 'contração' },
    acceptedAnswers: ["She's from Austin", 'She is from Austin'],
  };

  it('não vê mudança quando o conteúdo é o mesmo com chaves fora de ordem', () => {
    expect(
      immutableFieldChanges(
        { ...current, content: { a: 1, b: 2 } },
        { content: { b: 2, a: 1 } },
      ),
    ).toEqual([]);
  });

  it('não vê mudança quando as respostas vêm em outra ordem', () => {
    expect(
      immutableFieldChanges(current, {
        acceptedAnswers: ['She is from Austin', "She's from Austin"],
      }),
    ).toEqual([]);
  });

  it('aponta o enunciado alterado', () => {
    expect(immutableFieldChanges(current, { prompt: 'Outro' })).toEqual([
      'prompt',
    ]);
  });

  it('exige item novo só depois de publicado', () => {
    expect(requiresNewItem('PUBLISHED', ['prompt'])).toBe(true);
    expect(requiresNewItem('ARCHIVED', ['prompt'])).toBe(true);
    expect(requiresNewItem('DRAFT', ['prompt'])).toBe(false);
    expect(requiresNewItem('APPROVED', ['prompt'])).toBe(false);
  });

  it('não exige item novo quando nada congelado mudou', () => {
    expect(requiresNewItem('PUBLISHED', [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// O que o aluno pode ver
// ---------------------------------------------------------------------------

describe('stripAnswerKey', () => {
  it('tira o gabarito da múltipla escolha', () => {
    const content = stripAnswerKey('MULTIPLE_CHOICE', {
      options: [{ id: 'a', text: 'am' }],
      correctOptionIds: ['a'],
      shuffle: true,
    });

    expect(content['correctOptionIds']).toBeUndefined();
    expect(content['options']).toHaveLength(1);
  });

  it('tira a tradução do texto de interpretação', () => {
    const content = stripAnswerKey('READING_COMPREHENSION', {
      passage: 'Lucas is from Brazil.',
      passageTranslation: 'Lucas é do Brasil.',
      options: [{ id: 'a', text: 'Brazil' }],
      correctOptionIds: ['a'],
    });

    expect(content['passageTranslation']).toBeUndefined();
    expect(content['correctOptionIds']).toBeUndefined();
  });

  it('separa os lados do MATCH e ordena a direita', () => {
    const content = stripAnswerKey('MATCH', {
      pairs: [
        { left: 'I', right: 'am' },
        { left: 'he', right: 'is' },
        { left: 'you', right: 'are' },
      ],
    });

    expect(content['pairs']).toBeUndefined();
    expect(content['lefts']).toEqual(['I', 'he', 'you']);
    // Ordem alfabética: mandar na ordem de autoria entregaria a ligação.
    expect(content['rights']).toEqual(['am', 'are', 'is']);
  });

  it('não mexe no que não tem gabarito embutido', () => {
    const content = stripAnswerKey('ORDER_WORDS', {
      tokens: ['I', 'am', 'Lucas'],
    });

    expect(content['tokens']).toEqual(['I', 'am', 'Lucas']);
  });

  it('sobrevive a conteúdo corrompido', () => {
    expect(stripAnswerKey('MULTIPLE_CHOICE', null)).toEqual({});
  });
});

describe('toStudentItem', () => {
  it('não deixa passar resposta, explicação nem mapa de erro', () => {
    const student = toStudentItem({
      id: ITEM,
      type: 'MULTIPLE_CHOICE',
      prompt: 'I ___ Maya.',
      content: {
        options: [{ id: 'a', text: 'am' }],
        correctOptionIds: ['a'],
      },
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present.affirmative'],
    });

    const serialized = JSON.stringify(student);

    expect(serialized).not.toContain('correctOptionIds');
    expect(serialized).not.toContain('acceptedAnswers');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('errorPatternMap');
    expect(student.prompt).toBe('I ___ Maya.');
  });
});
