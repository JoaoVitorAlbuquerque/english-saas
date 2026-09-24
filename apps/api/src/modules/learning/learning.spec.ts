import type { AnswerResponse } from '@english-saas/shared';

import {
  decideStart,
  missingSteps,
  nextStepIndex,
  unansweredItems,
} from './domain/attempt-progress';
import {
  evaluateAnswer,
  orderScore,
  responseShapeError,
  type EvaluableItem,
} from './domain/evaluate-answer';
import { computeItemStats, MIN_EXPOSURE_FOR_RATE } from './domain/item-stats';
import {
  daysBetween,
  localDate,
  registerStudyDay,
  visibleStreak,
  type StreakState,
} from './domain/streak';
import { answerXp, lessonXp, XP_RULES } from './domain/xp';

/**
 * Itens no mesmo formato do seed (`prisma/seeds/curriculum/items.ts`),
 * um por tipo. Escritos aqui, e não importados, para o teste do domínio não
 * depender do diretório do Prisma.
 */
function item(partial: Partial<EvaluableItem> & Pick<EvaluableItem, 'type'>) {
  return {
    content: {},
    acceptedAnswers: [],
    errorPatternMap: {},
    ...partial,
  } satisfies EvaluableItem;
}

const multipleChoice = item({
  type: 'MULTIPLE_CHOICE',
  content: {
    options: [
      { id: 'full', text: 'Yes, I am.' },
      { id: 'contracted', text: "Yes, I'm." },
      { id: 'bare', text: 'Yes, I.' },
    ],
    correctOptionIds: ['full'],
  },
  errorPatternMap: { "Yes, I'm.": 'short-answer.contracted' },
});

const listenChoose = item({
  type: 'LISTEN_CHOOSE',
  content: {
    audioText: "He's very friendly.",
    options: [
      { id: 'contracted', text: "He's very friendly." },
      { id: 'plural', text: 'They are very friendly.' },
    ],
    correctOptionIds: ['contracted'],
  },
});

const reading = item({
  type: 'READING_COMPREHENSION',
  content: {
    passage: "Lucas is 24. He's from Campinas. He lives in Austin now.",
    options: [
      { id: 'campinas', text: 'Campinas' },
      { id: 'austin', text: 'Austin' },
    ],
    correctOptionIds: ['campinas'],
  },
});

const fillBlank = item({
  type: 'FILL_BLANK',
  content: { sentence: '___ you new here?' },
  acceptedAnswers: ['Are'],
  errorPatternMap: { 'You are': 'word-order.question' },
});

const typeAnswer = item({
  type: 'TYPE_ANSWER',
  content: { sourceText: 'Ela é de Austin.' },
  acceptedAnswers: ["She's from Austin"],
  errorPatternMap: { 'She from Austin': 'l1.missing-subject' },
});

const dictation = item({
  type: 'DICTATION',
  content: { audioText: "I'm from Brazil.", maxPlays: 3 },
  acceptedAnswers: ["I'm from Brazil."],
});

const registerSwap = item({
  type: 'REGISTER_SWAP',
  content: {
    source: 'I am going to call you.',
    direction: 'STANDARD_TO_SPOKEN',
    registerNoteId: 'gonna',
  },
  acceptedAnswers: ["I'm gonna call you."],
});

const orderNice = item({
  type: 'ORDER_WORDS',
  content: { tokens: ['meet', 'Nice', 'you', 'to'] },
  acceptedAnswers: ['Nice to meet you'],
});

const orderBrazil = item({
  type: 'ORDER_WORDS',
  content: { tokens: ['from', "I'm", 'Brazil'] },
  acceptedAnswers: ["I'm from Brazil"],
});

const match = item({
  type: 'MATCH',
  content: {
    pairs: [
      { left: 'I', right: 'am' },
      { left: 'he', right: 'is' },
      { left: 'they', right: 'are' },
    ],
  },
});

function evaluate(target: EvaluableItem, response: AnswerResponse) {
  expect(responseShapeError(target, response)).toBeNull();
  return evaluateAnswer(target, response);
}

// ---------------------------------------------------------------------------

describe('evaluateAnswer — escolha', () => {
  it('MULTIPLE_CHOICE: acerta com a alternativa certa', () => {
    const result = evaluate(multipleChoice, { optionIds: ['full'] });

    expect(result).toMatchObject({
      isCorrect: true,
      score: 1,
      verdict: 'CORRECT',
      errorPatterns: [],
      correctAnswer: { optionIds: ['full'], texts: ['Yes, I am.'] },
    });
  });

  it('MULTIPLE_CHOICE: erro típico vem do texto da alternativa escolhida', () => {
    const result = evaluate(multipleChoice, { optionIds: ['contracted'] });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
    expect(result.verdict).toBe('INCORRECT');
    expect(result.errorPatterns).toEqual(['short-answer.contracted']);
  });

  it('MULTIPLE_CHOICE: errar sem erro mapeado não inventa padrão', () => {
    expect(
      evaluate(multipleChoice, { optionIds: ['bare'] }).errorPatterns,
    ).toEqual([]);
  });

  it('marcar a certa e mais uma não é acerto parcial — é erro', () => {
    const result = evaluate(multipleChoice, { optionIds: ['full', 'bare'] });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
  });

  it('LISTEN_CHOOSE: corrige como escolha', () => {
    expect(
      evaluate(listenChoose, { optionIds: ['contracted'] }).isCorrect,
    ).toBe(true);
    expect(evaluate(listenChoose, { optionIds: ['plural'] }).isCorrect).toBe(
      false,
    );
  });

  it('READING_COMPREHENSION: corrige como escolha', () => {
    expect(evaluate(reading, { optionIds: ['campinas'] }).isCorrect).toBe(true);
    expect(evaluate(reading, { optionIds: ['austin'] }).isCorrect).toBe(false);
  });
});

describe('evaluateAnswer — digitados', () => {
  it('FILL_BLANK: ignora caixa e pontuação', () => {
    expect(evaluate(fillBlank, { text: 'are' }).isCorrect).toBe(true);
    expect(evaluate(fillBlank, { text: '  Are. ' }).isCorrect).toBe(true);
  });

  it('FILL_BLANK: resposta errada com erro mapeado', () => {
    const result = evaluate(fillBlank, { text: 'you are' });

    expect(result.isCorrect).toBe(false);
    expect(result.errorPatterns).toEqual(['word-order.question']);
    expect(result.correctAnswer).toEqual({ text: 'Are' });
  });

  it('TYPE_ANSWER: forma expandida vale pela contraída', () => {
    expect(evaluate(typeAnswer, { text: 'she is from austin' }).isCorrect).toBe(
      true,
    );
    expect(evaluate(typeAnswer, { text: 'She’s from Austin.' }).isCorrect).toBe(
      true,
    );
  });

  it('TYPE_ANSWER: detecta o sujeito faltando', () => {
    const result = evaluate(typeAnswer, { text: 'she from austin' });

    expect(result.isCorrect).toBe(false);
    expect(result.errorPatterns).toEqual(['l1.missing-subject']);
  });

  it('TYPE_ANSWER: resposta vazia é erro, não exceção', () => {
    const result = evaluate(typeAnswer, { text: '   ' });

    expect(result.isCorrect).toBe(false);
    expect(result.errorPatterns).toEqual([]);
  });

  it('DICTATION: pontuação não conta', () => {
    expect(evaluate(dictation, { text: 'i am from brazil' }).isCorrect).toBe(
      true,
    );
    expect(evaluate(dictation, { text: 'I from Brazil' }).isCorrect).toBe(
      false,
    );
  });

  it('REGISTER_SWAP: "going to" não vale por "gonna" — é o que o item mede', () => {
    expect(
      evaluate(registerSwap, { text: "I'm gonna call you" }).isCorrect,
    ).toBe(true);
    expect(
      evaluate(registerSwap, { text: 'I am going to call you.' }).isCorrect,
    ).toBe(false);
  });
});

describe('evaluateAnswer — crédito parcial', () => {
  it('ORDER_WORDS: ordem certa é 1', () => {
    const result = evaluate(orderNice, {
      tokens: ['Nice', 'to', 'meet', 'you'],
    });

    expect(result).toMatchObject({ isCorrect: true, score: 1 });
  });

  it('ORDER_WORDS: duas peças trocadas rendem 3/4', () => {
    const result = evaluate(orderNice, {
      tokens: ['Nice', 'meet', 'to', 'you'],
    });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0.75);
    expect(result.verdict).toBe('PARTIAL');
    expect(result.feedback).toContain('75%');
    expect(result.correctAnswer).toEqual({ text: 'Nice to meet you' });
  });

  it('ORDER_WORDS: contração conta como as duas palavras que ela é', () => {
    // "brazil from i am" × "i am from brazil": a maior subsequência comum
    // tem 2 palavras de 4.
    const result = evaluate(orderBrazil, { tokens: ['Brazil', 'from', "I'm"] });

    expect(result.score).toBe(0.5);
    expect(result.isCorrect).toBe(false);
  });

  it('ORDER_WORDS: nunca dá 1 sem acertar', () => {
    const result = evaluate(orderBrazil, { tokens: ["I'm", 'Brazil', 'from'] });

    expect(result.score).toBeLessThan(1);
    expect(result.isCorrect).toBe(false);
  });

  it('MATCH: todos os pares certos é 1', () => {
    const result = evaluate(match, {
      pairs: [
        { left: 'I', right: 'am' },
        { left: 'he', right: 'is' },
        { left: 'they', right: 'are' },
      ],
    });

    expect(result).toMatchObject({ isCorrect: true, score: 1 });
  });

  it('MATCH: dois de três pares', () => {
    const result = evaluate(match, {
      pairs: [
        { left: 'I', right: 'am' },
        { left: 'he', right: 'are' },
        { left: 'they', right: 'is' },
      ],
    });

    expect(result.score).toBe(0.33);
    expect(result.verdict).toBe('PARTIAL');
  });

  it('MATCH: par não enviado conta como errado', () => {
    const result = evaluate(match, { pairs: [{ left: 'I', right: 'am' }] });

    expect(result.score).toBe(0.33);
    expect(result.correctAnswer).toEqual({
      pairs: [
        { left: 'I', right: 'am' },
        { left: 'he', right: 'is' },
        { left: 'they', right: 'are' },
      ],
    });
  });

  it('orderScore: divide pelo maior dos dois', () => {
    expect(orderScore(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
    expect(orderScore(['c', 'b', 'a'], ['a', 'b', 'c'])).toBe(0.33);
    expect(orderScore(['a', 'b'], ['a', 'b', 'c', 'd'])).toBe(0.5);
    expect(orderScore([], [])).toBe(0);
  });
});

describe('responseShapeError', () => {
  it('recusa formato de outra família', () => {
    expect(responseShapeError(multipleChoice, { text: 'full' })).not.toBeNull();
    expect(responseShapeError(typeAnswer, { optionIds: ['a'] })).not.toBeNull();
    expect(responseShapeError(orderNice, { text: 'Nice' })).not.toBeNull();
    expect(responseShapeError(match, { optionIds: ['I'] })).not.toBeNull();
  });

  it('recusa alternativa que não existe', () => {
    expect(
      responseShapeError(multipleChoice, { optionIds: ['nope'] }),
    ).not.toBeNull();
  });

  it('ORDER_WORDS: só aceita exatamente as peças do item', () => {
    expect(
      responseShapeError(orderNice, { tokens: ['Nice', 'to', 'meet'] }),
    ).not.toBeNull();
    expect(
      responseShapeError(orderNice, {
        tokens: ['Nice', 'to', 'meet', 'you', 'too'],
      }),
    ).not.toBeNull();
    expect(
      responseShapeError(orderNice, { tokens: ['Nice', 'to', 'meet', 'me'] }),
    ).not.toBeNull();
  });

  it('MATCH: recusa lado repetido e par inventado', () => {
    expect(
      responseShapeError(match, {
        pairs: [
          { left: 'I', right: 'am' },
          { left: 'I', right: 'is' },
        ],
      }),
    ).not.toBeNull();
    expect(
      responseShapeError(match, { pairs: [{ left: 'we', right: 'are' }] }),
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('streak', () => {
  const SAO_PAULO = 'America/Sao_Paulo';
  const NEW_YORK = 'America/New_York';
  const empty: StreakState = {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
  };

  it('23h30 em São Paulo ainda é hoje lá, mesmo com o UTC no dia seguinte', () => {
    const instant = new Date('2026-09-25T02:30:00Z');

    expect(localDate(instant, 'UTC')).toBe('2026-09-25');
    expect(localDate(instant, SAO_PAULO)).toBe('2026-09-24');
  });

  it('fuso inválido cai no padrão em vez de quebrar', () => {
    const instant = new Date('2026-09-25T02:30:00Z');

    expect(localDate(instant, 'Not/AZone')).toBe('2026-09-24');
  });

  it('primeiro estudo abre a sequência em 1', () => {
    expect(registerStudyDay(empty, '2026-09-24')).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastStudyDate: '2026-09-24',
    });
  });

  it('estudar duas vezes no mesmo dia conta uma', () => {
    const day1 = registerStudyDay(empty, '2026-09-24');

    expect(registerStudyDay(day1, '2026-09-24')).toBe(day1);
  });

  it('dia seguinte soma um', () => {
    const day1 = registerStudyDay(empty, '2026-09-24');

    expect(registerStudyDay(day1, '2026-09-25').currentStreak).toBe(2);
  });

  it('pular um dia recomeça em 1 e guarda o recorde — sem outra punição', () => {
    const state: StreakState = {
      currentStreak: 7,
      longestStreak: 7,
      lastStudyDate: '2026-09-20',
    };

    expect(registerStudyDay(state, '2026-09-22')).toEqual({
      currentStreak: 1,
      longestStreak: 7,
      lastStudyDate: '2026-09-22',
    });
  });

  it('voltar no calendário (mudou de fuso) não zera nada', () => {
    const state: StreakState = {
      currentStreak: 3,
      longestStreak: 5,
      lastStudyDate: '2026-09-24',
    };

    expect(registerStudyDay(state, '2026-09-23')).toBe(state);
  });

  it('23h30 e 00h30 em São Paulo são dois dias seguidos', () => {
    const night = localDate(new Date('2026-09-25T02:30:00Z'), SAO_PAULO);
    const afterMidnight = localDate(
      new Date('2026-09-25T03:30:00Z'),
      SAO_PAULO,
    );

    const state = registerStudyDay(
      registerStudyDay(empty, night),
      afterMidnight,
    );

    expect([night, afterMidnight]).toEqual(['2026-09-24', '2026-09-25']);
    expect(state.currentStreak).toBe(2);
  });

  it('as mesmas duas horas UTC são um dia só para quem está em UTC', () => {
    const first = localDate(new Date('2026-09-25T02:30:00Z'), 'UTC');
    const second = localDate(new Date('2026-09-25T03:30:00Z'), 'UTC');

    expect(
      registerStudyDay(registerStudyDay(empty, first), second).currentStreak,
    ).toBe(1);
  });

  it('atravessa a troca de horário de verão de Nova York sem pular dia', () => {
    // 8/mar/2026 o relógio adianta. 23h30 de sábado (EST, UTC-5) e 23h30
    // de domingo (EDT, UTC-4) estão a 23h de distância, e são dias seguidos.
    const saturday = localDate(new Date('2026-03-08T04:30:00Z'), NEW_YORK);
    const sunday = localDate(new Date('2026-03-09T03:30:00Z'), NEW_YORK);

    expect([saturday, sunday]).toEqual(['2026-03-07', '2026-03-08']);
    expect(daysBetween(saturday, sunday)).toBe(1);
    expect(
      registerStudyDay(registerStudyDay(empty, saturday), sunday).currentStreak,
    ).toBe(2);
  });

  it('a sequência visível some depois de um dia inteiro sem estudo', () => {
    const state: StreakState = {
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate: '2026-09-23',
    };

    expect(visibleStreak(state, '2026-09-23')).toBe(4);
    expect(visibleStreak(state, '2026-09-24')).toBe(4);
    expect(visibleStreak(state, '2026-09-25')).toBe(0);
    expect(visibleStreak(empty, '2026-09-25')).toBe(0);
  });
});

describe('xp', () => {
  it('questão vale proporcional ao score, só na primeira tentativa', () => {
    expect(answerXp({ score: 1, isFirstTry: true })).toBe(XP_RULES.perItem);
    expect(answerXp({ score: 0.75, isFirstTry: true })).toBe(8);
    expect(answerXp({ score: 0, isFirstTry: true })).toBe(0);
    expect(answerXp({ score: 1, isFirstTry: false })).toBe(0);
  });

  it('lição concluída pela primeira vez leva o bônus cheio', () => {
    expect(
      lessonXp({
        answers: [
          { score: 1, isFirstTry: true },
          { score: 0, isFirstTry: true },
          { score: 1, isFirstTry: false },
        ],
        completedBefore: false,
      }),
    ).toEqual({ fromAnswers: 10, completionBonus: 20, total: 30 });
  });

  it('refazer lição já concluída ainda rende, só que menos', () => {
    expect(lessonXp({ answers: [], completedBefore: true })).toEqual({
      fromAnswers: 0,
      completionBonus: XP_RULES.lessonReplayCompletion,
      total: XP_RULES.lessonReplayCompletion,
    });
  });
});

describe('attempt-progress', () => {
  it('próxima etapa é a primeira não concluída, em qualquer ordem', () => {
    expect(nextStepIndex(4, [])).toBe(0);
    expect(nextStepIndex(4, [0, 2])).toBe(1);
    expect(nextStepIndex(4, [0, 1, 2, 3])).toBe(4);
  });

  it('lista as etapas que faltam', () => {
    expect(missingSteps(5, [0, 3])).toEqual([1, 2, 4]);
    expect(missingSteps(2, [0, 1])).toEqual([]);
  });

  it('prática só fecha com cada questão respondida ao menos uma vez', () => {
    expect(unansweredItems(['a', 'b', 'c'], ['a', 'c', 'a'])).toEqual(['b']);
    expect(unansweredItems(['a'], ['a'])).toEqual([]);
  });

  it('decide entre começar, retomar e recomeçar', () => {
    expect(decideStart(null, 'v2')).toEqual({ action: 'START' });
    expect(decideStart({ id: 't1', lessonVersionId: 'v2' }, 'v2')).toEqual({
      action: 'RESUME',
      attemptId: 't1',
    });
    expect(decideStart({ id: 't1', lessonVersionId: 'v1' }, 'v2')).toEqual({
      action: 'RESTART',
      abandonAttemptId: 't1',
    });
  });
});

describe('item-stats', () => {
  it('não publica taxa de acerto com pouca exposição', () => {
    expect(computeItemStats({ firstTries: 3, correctFirstTries: 3 })).toEqual({
      exposureCount: 3,
      correctRate: null,
    });
  });

  it('calcula a taxa a partir do mínimo de exposições', () => {
    expect(
      computeItemStats({
        firstTries: MIN_EXPOSURE_FOR_RATE,
        correctFirstTries: 7,
      }),
    ).toEqual({ exposureCount: MIN_EXPOSURE_FOR_RATE, correctRate: 0.7 });
  });

  it('não deixa acerto passar de exposição', () => {
    expect(
      computeItemStats({ firstTries: 12, correctFirstTries: 20 }).correctRate,
    ).toBe(1);
  });
});
