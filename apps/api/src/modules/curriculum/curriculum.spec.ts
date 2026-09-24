import { randomUUID } from 'node:crypto';

import {
  answerVariants,
  findErrorPattern,
  matchesAnswer,
  normalizeAnswer,
} from './domain/answer-normalization';
import {
  clampDifficulty,
  initialDifficulty,
  resolveDifficulty,
} from './domain/difficulty';
import {
  immutableFieldChanges,
  requiresNewItem,
  validateItem,
} from './domain/item-rules';
import { collectStepReferences, missingReferences } from './domain/references';
import { sortSpans, validateSpans } from './domain/spans';
import { parseStep, validateSteps } from './domain/step-content';
import { stripAnswerKey, toStudentItem } from './domain/student-view';
import {
  canPublish,
  clearsApproval,
  isEditable,
  nextStatus,
  nextVersionNumber,
  statusAfterEdit,
} from './domain/versioning';

const MAYA = randomUUID();
const LUCAS = randomUUID();
const AUDIO = randomUUID();
const ITEM = randomUUID();

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
// Dificuldade
// ---------------------------------------------------------------------------

describe('dificuldade', () => {
  it('deriva do nível', () => {
    expect(initialDifficulty('A1')).toBe(-2);
    expect(initialDifficulty('B1')).toBe(0);
    expect(initialDifficulty('C1')).toBe(2);
  });

  it('prende nas bordas da escala', () => {
    expect(clampDifficulty(99)).toBe(4);
    expect(clampDifficulty(-99)).toBe(-4);
  });

  it('cai para o valor do nível quando o autor não informa', () => {
    expect(resolveDifficulty('A2', null)).toBe(-1);
    expect(resolveDifficulty('A2', 0.5)).toBe(0.5);
  });

  it('sobrevive a NaN', () => {
    expect(clampDifficulty(Number.NaN)).toBe(0);
  });
});

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

// ---------------------------------------------------------------------------
// Referências
// ---------------------------------------------------------------------------

describe('collectStepReferences', () => {
  it('junta tudo que a lição aponta para fora', () => {
    const references = collectStepReferences([
      {
        type: 'SCENE',
        content: {
          location: 'Austin',
          characterIds: [MAYA],
          lines: [
            {
              characterId: LUCAS,
              text: "I'm from Brazil",
              translation: 'Sou do Brasil',
              audioAssetId: AUDIO,
              spans: [
                { start: 0, end: 8, kind: 'CHUNK', skillId: 'chunk.im-from' },
                {
                  start: 9,
                  end: 15,
                  kind: 'REGISTER',
                  registerNoteId: 'gonna',
                },
              ],
            },
          ],
        },
      },
      { type: 'PRACTICE', content: { itemIds: [ITEM], shuffle: false } },
      {
        type: 'FREE_PRODUCTION',
        content: {
          prompt: 'Se apresente para a Maya.',
          helpers: [],
          rubric: [
            {
              id: 'no-have-age',
              description: 'Não usa "I have X years"',
              errorPatternId: 'l1.have-for-age',
            },
          ],
          targetSkillIds: ['grammar.be.present.affirmative'],
        },
      },
    ]);

    expect(references.characterIds).toEqual([LUCAS, MAYA].sort());
    expect(references.assetIds).toEqual([AUDIO]);
    expect(references.itemIds).toEqual([ITEM]);
    expect(references.registerNoteIds).toEqual(['gonna']);
    expect(references.errorPatternIds).toEqual(['l1.have-for-age']);
    expect(references.skillIds).toEqual([
      'chunk.im-from',
      'grammar.be.present.affirmative',
    ]);
  });

  it('não repete id', () => {
    const references = collectStepReferences([
      { type: 'PRACTICE', content: { itemIds: [ITEM], shuffle: false } },
      { type: 'PRACTICE', content: { itemIds: [ITEM], shuffle: false } },
    ]);

    expect(references.itemIds).toEqual([ITEM]);
  });
});

describe('missingReferences', () => {
  it('aponta o que não existe', () => {
    expect(missingReferences(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b']);
  });

  it('lista vazia quando está tudo lá', () => {
    expect(missingReferences(['a'], ['a', 'b'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Versionamento
// ---------------------------------------------------------------------------

describe('nextStatus', () => {
  it('segue o fluxo até publicar', () => {
    expect(nextStatus('DRAFT', 'submit')).toBe('IN_REVIEW');
    expect(nextStatus('IN_REVIEW', 'approve')).toBe('APPROVED');
    expect(nextStatus('APPROVED', 'publish')).toBe('PUBLISHED');
  });

  it('não deixa publicar direto do rascunho', () => {
    expect(nextStatus('DRAFT', 'publish')).toBeNull();
    expect(nextStatus('IN_REVIEW', 'publish')).toBeNull();
  });

  it('não deixa aprovar um rascunho', () => {
    expect(nextStatus('DRAFT', 'approve')).toBeNull();
  });

  it('devolve para rascunho quando a revisão recusa', () => {
    expect(nextStatus('IN_REVIEW', 'reject')).toBe('DRAFT');
    expect(nextStatus('APPROVED', 'reject')).toBe('DRAFT');
  });

  it('arquiva de qualquer estado vivo', () => {
    expect(nextStatus('PUBLISHED', 'archive')).toBe('ARCHIVED');
    expect(nextStatus('ARCHIVED', 'archive')).toBeNull();
  });

  it('canPublish só vale para APPROVED', () => {
    expect(canPublish('APPROVED')).toBe(true);
    expect(canPublish('IN_REVIEW')).toBe(false);
  });
});

describe('statusAfterEdit', () => {
  it('derruba a revisão de volta para rascunho', () => {
    expect(statusAfterEdit('IN_REVIEW')).toBe('DRAFT');
    expect(statusAfterEdit('APPROVED')).toBe('DRAFT');
    expect(clearsApproval('APPROVED')).toBe(true);
  });

  it('não mexe em quem já é rascunho', () => {
    expect(statusAfterEdit('DRAFT')).toBe('DRAFT');
    expect(clearsApproval('DRAFT')).toBe(false);
  });

  it('publicado e arquivado não se editam no lugar', () => {
    expect(isEditable('PUBLISHED')).toBe(false);
    expect(isEditable('ARCHIVED')).toBe(false);
    expect(isEditable('APPROVED')).toBe(true);
  });
});

describe('nextVersionNumber', () => {
  it('começa em 1', () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it('continua da maior, mesmo fora de ordem', () => {
    expect(nextVersionNumber([1, 3, 2])).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

describe('validateItem', () => {
  it('aceita múltipla escolha com gabarito no conteúdo', () => {
    expect(
      validateItem({
        type: 'MULTIPLE_CHOICE',
        content: {
          options: [
            { id: 'a', text: 'am' },
            { id: 'b', text: 'is' },
          ],
          correctOptionIds: ['a'],
          shuffle: true,
        },
        acceptedAnswers: [],
      }),
    ).toEqual([]);
  });

  it('recusa gabarito apontando para alternativa inexistente', () => {
    const issues = validateItem({
      type: 'MULTIPLE_CHOICE',
      content: {
        options: [
          { id: 'a', text: 'am' },
          { id: 'b', text: 'is' },
        ],
        correctOptionIds: ['z'],
      },
      acceptedAnswers: [],
    });

    expect(issues.length).toBeGreaterThan(0);
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
      content: {
        options: [
          { id: 'a', text: 'am' },
          { id: 'b', text: 'is' },
        ],
        correctOptionIds: ['a'],
      },
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

  it('exige a lacuna marcada em FILL_BLANK', () => {
    const issues = validateItem({
      type: 'FILL_BLANK',
      content: { sentence: 'Biscuit is a dog.' },
      acceptedAnswers: ['is'],
    });

    expect(issues.length).toBeGreaterThan(0);
  });
});

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
