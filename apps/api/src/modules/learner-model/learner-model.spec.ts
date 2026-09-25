import {
  applyAnswers,
  correctionOf,
  type ModelItem,
} from './domain/apply-answers';
import {
  aggregateCompetency,
  confidenceFor,
  levelsByCompetency,
  nextLevel,
  overallLevel,
  thetaToLevel,
  weekStartOf,
} from './domain/competency-level';
import {
  answerText,
  emptyErrorState,
  ERROR_WINDOW,
  isRecurring,
  opportunitiesOf,
  recentOccurrences,
  recordOpportunity,
  type ErrorState,
} from './domain/error-profile';
import {
  applyInterestSignal,
  LEARNED_INTEREST_START,
} from './domain/interests';
import {
  buildLearnerModel,
  nextTargets,
  type GraphSkill,
  type ModelInput,
} from './domain/learner-model';
import {
  applyAnswer,
  decayedTheta,
  effectiveScore,
  initialSkillState,
  learningRate,
  masteryOf,
  probabilityCorrect,
  skillWeight,
  type SkillState,
} from './domain/mastery';
import {
  classifySkill,
  findStrengths,
  findWeaknesses,
  rankNeeds,
} from './domain/profile';
import { buildSnapshot, buildStudentProfile } from './domain/snapshot';

const DAY = 86_400_000;
const T0 = new Date('2026-09-01T12:00:00Z');

/** PRNG com semente (mulberry32). `domain/` não sorteia: a aleatoriedade entra por parâmetro. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ---------------------------------------------------------------------------

describe('mastery', () => {
  it('p = 0.5 quando theta iguala a dificuldade, e sobe com a distância', () => {
    expect(probabilityCorrect(0, 0)).toBe(0.5);
    expect(probabilityCorrect(1, 0)).toBeCloseTo(0.731, 3);
    expect(probabilityCorrect(-2, 0)).toBeCloseTo(0.119, 3);
  });

  it('K começa em 0.8, cai com a evidência e para no piso de 0.1', () => {
    expect(learningRate(0)).toBe(0.8);
    expect(learningRate(10)).toBeCloseTo(0.32, 5);
    expect(learningRate(1_000)).toBe(0.1);
  });

  it('resposta com dica vale 70%; resposta rápida e errada conta normal', () => {
    expect(effectiveScore(1, 0)).toBe(1);
    expect(effectiveScore(1, 2)).toBeCloseTo(0.7, 5);
    expect(effectiveScore(0, 0)).toBe(0);
  });

  it('skill principal pesa 1, as outras 0.5', () => {
    expect(skillWeight(0)).toBe(1);
    expect(skillWeight(1)).toBe(0.5);
    expect(skillWeight(3)).toBe(0.5);
  });

  it('skill nova começa em mastery 0.5 — "não sei", não "sei"', () => {
    const state = initialSkillState('A1');

    expect(state.theta).toBe(-2);
    expect(masteryOf(state, 'A1', T0)).toBe(0.5);
  });

  it('acerto sobe o theta, erro desce, e a secundária anda metade', () => {
    const start = initialSkillState('A1');
    const signal = {
      difficulty: -2,
      score: 1,
      isCorrect: true,
      hintsUsed: 0,
      at: T0,
    };

    const primary = applyAnswer(start, { ...signal, weight: 1 });
    const secondary = applyAnswer(start, { ...signal, weight: 0.5 });
    const wrong = applyAnswer(start, {
      ...signal,
      score: 0,
      isCorrect: false,
      weight: 1,
    });

    expect(primary.theta).toBeCloseTo(-2 + 0.8 * 0.5, 5);
    expect(secondary.theta - start.theta).toBeCloseTo(
      (primary.theta - start.theta) / 2,
      5,
    );
    expect(wrong.theta).toBeLessThan(start.theta);
    expect(primary).toMatchObject({
      evidenceCount: 1,
      correctStreak: 1,
      lastPracticedAt: T0,
    });
    expect(secondary.evidenceCount).toBe(0.5);
    expect(wrong.correctStreak).toBe(0);
  });

  it('acerto com dica sobe menos que acerto limpo', () => {
    const start = initialSkillState('A1');
    const base = {
      difficulty: -2,
      score: 1,
      isCorrect: true,
      weight: 1,
      at: T0,
    };

    expect(applyAnswer(start, { ...base, hintsUsed: 1 }).theta).toBeLessThan(
      applyAnswer(start, { ...base, hintsUsed: 0 }).theta,
    );
  });

  it('decaimento: nada em duas semanas, depois devagar, com teto de 0.5', () => {
    const state: SkillState = {
      theta: 1,
      evidenceCount: 10,
      correctStreak: 0,
      lastPracticedAt: T0,
    };

    expect(decayedTheta(state, new Date(T0.getTime() + 14 * DAY))).toBe(1);
    expect(decayedTheta(state, new Date(T0.getTime() + 24 * DAY))).toBeCloseTo(
      0.9,
      5,
    );
    expect(decayedTheta(state, new Date(T0.getTime() + 400 * DAY))).toBeCloseTo(
      0.5,
      5,
    );
  });

  describe('convergência (aluno verdadeiro com theta 0.5, 60 itens)', () => {
    const TRUE_THETA = 0.5;

    function simulate(seed: number): number {
      const random = seeded(seed);
      let state = initialSkillState('B1');

      for (let index = 0; index < 60; index += 1) {
        const difficulty = TRUE_THETA + (random() * 2 - 1);
        const correct = random() < probabilityCorrect(TRUE_THETA, difficulty);

        state = applyAnswer(state, {
          difficulty,
          score: correct ? 1 : 0,
          isCorrect: correct,
          hintsUsed: 0,
          weight: 1,
          at: T0,
        });
      }

      return state.theta;
    }

    /**
     * 60 respostas certo/errado não bastam para cravar theta em ±0.3 em
     * toda execução — com p perto de 0.5, o erro padrão de *qualquer*
     * estimador é ~1/√(60·0.25) ≈ 0.26. Por isso o teste olha a
     * distribuição em 1.000 sementes, e não uma semente escolhida a dedo.
     */
    const estimates = Array.from({ length: 1_000 }, (_, seed) =>
      simulate(seed + 1),
    ).sort((a, b) => a - b);

    it('a estimativa mediana cai perto do valor verdadeiro', () => {
      const median = estimates[estimates.length / 2] ?? Number.NaN;

      expect(median).toBeGreaterThan(0.35);
      expect(median).toBeLessThan(0.65);
    });

    it('a grande maioria das execuções termina entre 0.2 e 0.8', () => {
      const inside = estimates.filter(
        (theta) => theta >= 0.2 && theta <= 0.8,
      ).length;

      expect(inside / estimates.length).toBeGreaterThanOrEqual(0.7);
    });

    it('nenhuma execução diverge', () => {
      expect(estimates[0]).toBeGreaterThan(-0.5);
      expect(estimates.at(-1)).toBeLessThan(1.5);
    });
  });
});

// ---------------------------------------------------------------------------

describe('competency-level', () => {
  it('faixas: A1 < -1.5 ≤ A2 < -0.5 ≤ B1 < 0.5 ≤ B2 < 1.5 ≤ C1', () => {
    expect(thetaToLevel(-1.51)).toBe('A1');
    expect(thetaToLevel(-1.5)).toBe('A2');
    expect(thetaToLevel(-0.5)).toBe('B1');
    expect(thetaToLevel(0.5)).toBe('B2');
    expect(thetaToLevel(1.5)).toBe('C1');
    expect(thetaToLevel(4)).toBe('C1');
  });

  it('confiança pela evidência total', () => {
    expect(confidenceFor(0)).toBe('LOW');
    expect(confidenceFor(9.5)).toBe('LOW');
    expect(confidenceFor(10)).toBe('MEDIUM');
    expect(confidenceFor(30)).toBe('HIGH');
  });

  it('média ponderada pela evidência; skill sem evidência não puxa', () => {
    expect(
      aggregateCompetency([
        { theta: -2, evidence: 3 },
        { theta: 0, evidence: 1 },
        { theta: 3, evidence: 0 },
      ]),
    ).toEqual({ theta: -1.5, level: 'A2', confidence: 'LOW', evidence: 4 });

    expect(aggregateCompetency([])).toEqual({
      theta: null,
      level: null,
      confidence: 'LOW',
      evidence: 0,
    });
  });

  it('nível geral: mediana conservadora das competências confiáveis', () => {
    const levels = levelsByCompetency([
      { competency: 'GRAMMAR', theta: 0.8, evidence: 12 }, // B2
      { competency: 'VOCABULARY', theta: -0.8, evidence: 12 }, // A2
      { competency: 'LISTENING', theta: 0, evidence: 40 }, // B1
      { competency: 'READING', theta: 1, evidence: 20 }, // B2
      { competency: 'WRITING', theta: 3, evidence: 2 }, // pouca evidência: fora
    ]);

    // Confiáveis: -0.8, 0, 0.8, 1 → das duas do meio, a menor (0) = B1.
    expect(overallLevel(levels, null)).toEqual({
      level: 'B1',
      source: 'MODEL',
    });
  });

  it('sem competência confiável, usa o nível informado no cadastro; sem ele, A1', () => {
    const empty = levelsByCompetency([]);

    expect(overallLevel(empty, 'INTERMEDIATE')).toEqual({
      level: 'B1',
      source: 'SELF_REPORTED',
    });
    expect(overallLevel(empty, 'NONE')).toEqual({
      level: 'A1',
      source: 'SELF_REPORTED',
    });
    expect(overallLevel(empty, null)).toEqual({
      level: 'A1',
      source: 'DEFAULT',
    });
  });

  it('próximo nível e segunda-feira da semana', () => {
    expect(nextLevel('A1')).toBe('A2');
    expect(nextLevel('C1')).toBe('C1');
    expect(weekStartOf(new Date('2026-09-25T10:00:00Z'))).toBe('2026-09-21');
    expect(weekStartOf(new Date('2026-09-27T23:00:00Z'))).toBe('2026-09-21');
    expect(weekStartOf(new Date('2026-09-21T00:00:00Z'))).toBe('2026-09-21');
  });
});

// ---------------------------------------------------------------------------

describe('error-profile', () => {
  const example = (text: string) => ({
    text,
    correction: "I'm 20 years old",
    itemId: 'item',
    at: T0.toISOString(),
  });

  function repeat(state: ErrorState, hits: boolean[]): ErrorState {
    return hits.reduce(
      (current, hit, index) =>
        recordOpportunity(current, {
          hit,
          at: T0,
          example: hit ? example(`erro ${String(index)}`) : undefined,
        }),
      state,
    );
  }

  it('recorrente a partir de 3 ocorrências na janela', () => {
    const two = repeat(emptyErrorState(), [true, false, true]);
    const three = repeat(two, [true]);

    expect(isRecurring(two)).toBe(false);
    expect(isRecurring(three)).toBe(true);
    expect(three.totalOccurrences).toBe(3);
  });

  it('a janela guarda só as últimas 30 oportunidades', () => {
    const old = repeat(emptyErrorState(), [true, true, true]);
    const flushed = repeat(
      old,
      Array.from({ length: ERROR_WINDOW }, () => false),
    );

    expect(flushed.recentOutcomes).toHaveLength(ERROR_WINDOW);
    expect(recentOccurrences(flushed)).toBe(0);
    expect(isRecurring(flushed)).toBe(false);
    // O total histórico não esquece.
    expect(flushed.totalOccurrences).toBe(3);
  });

  it('guarda as 3 últimas frases erradas', () => {
    const state = repeat(emptyErrorState(), [true, true, true, true]);

    expect(state.examples.map((entry) => entry.text)).toEqual([
      'erro 1',
      'erro 2',
      'erro 3',
    ]);
  });

  it('oportunidade = erros do mapa do item + erros ligados às skills dele', () => {
    const bySkill = new Map([
      ['vocab.numbers-1-20', ['l1.have-for-age']],
      [
        'grammar.be.present.affirmative',
        ['l1.have-for-age', 'l1.missing-subject'],
      ],
    ]);

    expect(
      opportunitiesOf(
        {
          errorPatternMap: { 'She from Austin': 'l1.missing-subject' },
          skillIds: ['vocab.numbers-1-20'],
        },
        bySkill,
      ),
    ).toEqual(['l1.have-for-age', 'l1.missing-subject']);
  });

  it('texto do aluno por formato de resposta', () => {
    const content = {
      options: [
        { id: 'a', text: 'Yes, I am.' },
        { id: 'b', text: "Yes, I'm." },
      ],
    };

    expect(answerText({}, { text: ' I have 20 years ' })).toBe(
      'I have 20 years',
    );
    expect(answerText({}, { tokens: ['from', "I'm", 'Brazil'] })).toBe(
      "from I'm Brazil",
    );
    expect(answerText(content, { optionIds: ['b'] })).toBe("Yes, I'm.");
    expect(answerText({}, { pairs: [{ left: 'I', right: 'am' }] })).toBeNull();
    expect(answerText({}, { text: '   ' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('apply-answers', () => {
  const ageItem: ModelItem = {
    id: 'age',
    content: {},
    acceptedAnswers: ["I'm 20 years old"],
    errorPatternMap: { 'I have 20 years': 'l1.have-for-age' },
    difficulty: -2,
    skillIds: ['vocab.numbers-1-20', 'grammar.be.present.affirmative'],
  };

  const base = {
    items: new Map([[ageItem.id, ageItem]]),
    skillLevels: new Map([
      ['vocab.numbers-1-20', 'A1' as const],
      ['grammar.be.present.affirmative', 'A1' as const],
    ]),
    errorPatternsBySkill: new Map([
      ['vocab.numbers-1-20', ['l1.have-for-age']],
    ]),
    skillStates: new Map<string, SkillState>(),
    errorStates: new Map<string, ErrorState>(),
  };

  const answer = (
    index: number,
    isFirstTry: boolean,
    text: string,
    detected: string[],
  ) => ({
    id: `a${String(index)}`,
    itemId: 'age',
    isFirstTry,
    isCorrect: detected.length === 0,
    score: detected.length === 0 ? 1 : 0,
    hintsUsed: 0,
    detectedErrorPatterns: detected,
    response: { text },
    createdAt: new Date(T0.getTime() + index * 1_000),
  });

  it('theta só com a primeira tentativa; erro conta em todas', () => {
    const result = applyAnswers({
      ...base,
      answers: [
        answer(1, true, 'I have 20 years', ['l1.have-for-age']),
        answer(2, false, 'I have 20 years', ['l1.have-for-age']),
        answer(3, false, 'I have 20 years', ['l1.have-for-age']),
      ],
    });

    const primary = result.skillStates.get('vocab.numbers-1-20');
    const secondary = result.skillStates.get('grammar.be.present.affirmative');
    const error = result.errorStates.get('l1.have-for-age');

    expect(primary?.evidenceCount).toBe(1);
    expect(secondary?.evidenceCount).toBe(0.5);
    expect(primary?.theta).toBeLessThan(-2);
    expect(error && isRecurring(error)).toBe(true);
    expect(error?.examples[0]).toMatchObject({
      text: 'I have 20 years',
      correction: "I'm 20 years old",
      itemId: 'age',
    });
  });

  it('acerto registra oportunidade sem ocorrência', () => {
    const result = applyAnswers({
      ...base,
      answers: [answer(1, true, "I'm 20", [])],
    });

    expect(result.errorStates.get('l1.have-for-age')).toMatchObject({
      recentOutcomes: [false],
      totalOccurrences: 0,
    });
  });

  it('item desconhecido é ignorado, sem quebrar o lote', () => {
    const result = applyAnswers({
      ...base,
      answers: [{ ...answer(1, true, 'x', []), itemId: 'sumiu' }],
    });

    expect(result.touchedSkills.size).toBe(0);
  });

  it('correção de escolha vem do texto da alternativa certa', () => {
    expect(
      correctionOf({
        acceptedAnswers: [],
        content: {
          options: [
            { id: 'full', text: 'Yes, I am.' },
            { id: 'bare', text: 'Yes, I.' },
          ],
          correctOptionIds: ['full'],
        },
      }),
    ).toBe('Yes, I am.');
  });
});

// ---------------------------------------------------------------------------

describe('profile', () => {
  it('forte, fraco, neutro e sem dados', () => {
    expect(classifySkill({ skillId: 's', mastery: 0.85, evidence: 6 })).toBe(
      'STRONG',
    );
    expect(classifySkill({ skillId: 's', mastery: 0.85, evidence: 5 })).toBe(
      'UNKNOWN',
    );
    expect(classifySkill({ skillId: 's', mastery: 0.4, evidence: 4 })).toBe(
      'WEAK',
    );
    expect(classifySkill({ skillId: 's', mastery: 0.4, evidence: 3 })).toBe(
      'UNKNOWN',
    );
    expect(classifySkill({ skillId: 's', mastery: 0.6, evidence: 10 })).toBe(
      'NEUTRAL',
    );
  });

  it('fraqueza por erro recorrente só marca skill que o aluno praticou', () => {
    const weaknesses = findWeaknesses({
      readings: [
        { skillId: 'vocab.numbers-1-20', mastery: 0.45, evidence: 1 },
        {
          skillId: 'grammar.be.present.affirmative',
          mastery: 0.3,
          evidence: 5,
        },
      ],
      recurringErrorIds: ['l1.have-for-age'],
      skillsByErrorPattern: new Map([
        [
          'l1.have-for-age',
          ['vocab.numbers-1-20', 'function.introduce-yourself'],
        ],
      ]),
    });

    expect(weaknesses).toEqual([
      {
        skillId: 'grammar.be.present.affirmative',
        reasons: ['LOW_MASTERY'],
        errorPatternIds: [],
      },
      {
        skillId: 'vocab.numbers-1-20',
        reasons: ['RECURRING_ERROR'],
        errorPatternIds: ['l1.have-for-age'],
      },
    ]);
  });

  it('pontos fortes do mais para o menos dominado', () => {
    expect(
      findStrengths([
        { skillId: 'b', mastery: 0.82, evidence: 8 },
        { skillId: 'a', mastery: 0.95, evidence: 7 },
        { skillId: 'c', mastery: 0.9, evidence: 2 },
      ]),
    ).toEqual(['a', 'b']);
  });

  it('necessidades: fraqueza primeiro, forte fora, só nível atual e próximo', () => {
    const needs = rankNeeds({
      skills: [
        { skillId: 'weak-a1', cefrLevel: 'A1', goals: [], requiredByCount: 0 },
        { skillId: 'hub-a1', cefrLevel: 'A1', goals: [], requiredByCount: 4 },
        {
          skillId: 'goal-a2',
          cefrLevel: 'A2',
          goals: ['TRAVEL'],
          requiredByCount: 0,
        },
        { skillId: 'plain-a2', cefrLevel: 'A2', goals: [], requiredByCount: 0 },
        {
          skillId: 'far-b2',
          cefrLevel: 'B2',
          goals: ['TRAVEL'],
          requiredByCount: 4,
        },
        {
          skillId: 'strong-a1',
          cefrLevel: 'A1',
          goals: [],
          requiredByCount: 4,
        },
        { skillId: 'known-a1', cefrLevel: 'A1', goals: [], requiredByCount: 0 },
      ],
      readings: new Map([
        ['strong-a1', { skillId: 'strong-a1', mastery: 0.9, evidence: 10 }],
        ['known-a1', { skillId: 'known-a1', mastery: 0.7, evidence: 10 }],
      ]),
      weakSkillIds: new Set(['weak-a1']),
      currentLevel: 'A1',
      nextLevel: 'A2',
      goals: ['TRAVEL'],
    });

    expect(needs.map((need) => need.skillId)).toEqual([
      'weak-a1', // 1.5 + 0.3
      'hub-a1', // 1 + 0.3
      'goal-a2', // 0.5
      'plain-a2', // 0
    ]);
  });
});

// ---------------------------------------------------------------------------

describe('modelo montado e snapshot', () => {
  const graph: GraphSkill[] = [
    {
      id: 'grammar.be.present.affirmative',
      title: 'Verbo to be no presente',
      competency: 'GRAMMAR',
      cefrLevel: 'A1',
      goals: [],
      requiredByCount: 4,
      errorPatternIds: ['l1.have-for-age'],
    },
    {
      id: 'vocab.numbers-1-20',
      title: 'Números de 1 a 20',
      competency: 'VOCABULARY',
      cefrLevel: 'A1',
      goals: [],
      requiredByCount: 0,
      errorPatternIds: ['l1.have-for-age'],
    },
    {
      id: 'chunk.nice-to-meet-you',
      title: 'Nice to meet you',
      competency: 'SPEAKING',
      cefrLevel: 'A1',
      goals: ['CONVERSATION'],
      requiredByCount: 0,
      errorPatternIds: [],
    },
    {
      id: 'grammar.past-simple',
      title: 'Passado simples',
      competency: 'GRAMMAR',
      cefrLevel: 'A2',
      goals: [],
      requiredByCount: 2,
      errorPatternIds: [],
    },
  ];

  const recurring = repeatError([
    'I have 20 years',
    'I have 20 years old',
    'I have 20 years',
  ]);

  function repeatError(texts: string[]): ErrorState {
    return texts.reduce(
      (state, text, index) =>
        recordOpportunity(state, {
          hit: true,
          at: new Date(T0.getTime() + index * 1_000),
          example: {
            text,
            correction: "I'm 20 years old",
            itemId: 'age',
            at: T0.toISOString(),
          },
        }),
      emptyErrorState(),
    );
  }

  const input: ModelInput = {
    now: T0,
    graph,
    skillStates: new Map<string, SkillState>([
      [
        'chunk.nice-to-meet-you',
        { theta: 0, evidenceCount: 8, correctStreak: 8, lastPracticedAt: T0 },
      ],
      [
        'vocab.numbers-1-20',
        {
          theta: -2.3,
          evidenceCount: 1,
          correctStreak: 0,
          lastPracticedAt: T0,
        },
      ],
      [
        'grammar.be.present.affirmative',
        {
          theta: -1.6,
          evidenceCount: 5,
          correctStreak: 2,
          lastPracticedAt: T0,
        },
      ],
    ]),
    errorStates: new Map([['l1.have-for-age', recurring]]),
    errorPatterns: [
      {
        id: 'l1.have-for-age',
        description: 'Usa "have" para idade, como em português.',
        correction: "I'm 20 years old.",
        explanation: 'Idade vai com to be.',
      },
    ],
    goals: ['CONVERSATION'],
    selfReportedLevel: 'NONE',
  };

  it('o erro recorrente vira ponto fraco e a skill ligada vira alvo', () => {
    const model = buildLearnerModel(input);

    expect(model.recurringErrors.map((error) => error.id)).toEqual([
      'l1.have-for-age',
    ]);
    expect(model.weaknesses.map((weakness) => weakness.skillId)).toEqual([
      'grammar.be.present.affirmative',
      'vocab.numbers-1-20',
    ]);
    expect(nextTargets(model).map((need) => need.skillId)).toContain(
      'vocab.numbers-1-20',
    );
    expect(model.strengths.map((skill) => skill.skillId)).toEqual([
      'chunk.nice-to-meet-you',
    ]);
    // Forte nunca é alvo, e skill do próximo nível entra como necessidade.
    expect(nextTargets(model).map((need) => need.skillId)).not.toContain(
      'chunk.nice-to-meet-you',
    );
    expect(nextTargets(model).map((need) => need.skillId)).toContain(
      'grammar.past-simple',
    );
  });

  it('snapshot: formato compacto, exemplos reais, determinístico', () => {
    const model = buildLearnerModel(input);
    const snapshot = buildSnapshot({
      model,
      interests: [
        { topic: 'music', weight: 40 },
        { topic: 'history', weight: 80 },
        { topic: 'football', weight: 60 },
        { topic: 'movies', weight: 20 },
        { topic: 'games', weight: 50 },
        { topic: 'cooking', weight: 10 },
      ],
      goals: ['CONVERSATION'],
      recentTopics: ['Nice to meet you'],
    });

    expect(snapshot).toMatchObject({
      version: 1,
      overallLevel: { level: 'A1', source: 'SELF_REPORTED' },
      strengths: [
        { skillId: 'chunk.nice-to-meet-you', title: 'Nice to meet you' },
      ],
      weaknesses: {
        errorPatterns: [
          {
            id: 'l1.have-for-age',
            recentOccurrences: 3,
            examples: [
              'I have 20 years',
              'I have 20 years old',
              'I have 20 years',
            ],
          },
        ],
      },
      knownVocabularyLevel: 'A1',
      goals: ['CONVERSATION'],
      recentTopics: ['Nice to meet you'],
    });
    expect(snapshot.interests.map((interest) => interest.topic)).toEqual([
      'history',
      'football',
      'games',
      'music',
      'movies',
    ]);
    expect(snapshot.nextTargetSkills.length).toBeLessThanOrEqual(5);
    expect(snapshot.nextTargetSkills.map((skill) => skill.skillId)).toContain(
      'vocab.numbers-1-20',
    );
    expect(Object.keys(snapshot.levelsByCompetency)).toHaveLength(6);

    // Mesmo estado, mesmo JSON: é o que deixa o cache de IA acertar.
    expect(
      JSON.stringify(
        buildSnapshot({
          model: buildLearnerModel(input),
          interests: [
            ...[
              { topic: 'cooking', weight: 10 },
              { topic: 'music', weight: 40 },
              { topic: 'history', weight: 80 },
              { topic: 'football', weight: 60 },
              { topic: 'movies', weight: 20 },
              { topic: 'games', weight: 50 },
            ],
          ],
          goals: ['CONVERSATION'],
          recentTopics: ['Nice to meet you'],
        }),
      ),
    ).toBe(JSON.stringify(snapshot));
  });

  it('perfil do aluno em pt-BR, com as frases dele', () => {
    const profile = buildStudentProfile({
      model: buildLearnerModel(input),
      goals: ['CONVERSATION'],
    });

    expect(profile.overallLevel.note).toContain('cadastro');
    expect(profile.errors[0]).toMatchObject({
      id: 'l1.have-for-age',
      occurrences: 3,
      yourExamples: [
        'I have 20 years',
        'I have 20 years old',
        'I have 20 years',
      ],
    });
    expect(
      profile.weaknesses.find(
        (weakness) => weakness.skillId === 'vocab.numbers-1-20',
      )?.why,
    ).toContain('Usa "have" para idade');
    expect(profile.needs[0]?.why).toContain('ponto fraco');
    expect(profile.goals).toEqual([
      { goal: 'CONVERSATION', label: expect.any(String) },
    ]);
  });
});

describe('interests', () => {
  it('sinal positivo sobe, negativo desce, com teto', () => {
    expect(applyInterestSignal(50, 'MATERIAL_COMPLETED')).toBe(58);
    expect(applyInterestSignal(50, 'MATERIAL_ABANDONED')).toBe(45);
    expect(applyInterestSignal(98, 'MATERIAL_RATED_HIGH')).toBe(100);
    expect(applyInterestSignal(2, 'MATERIAL_RATED_LOW')).toBe(0);
  });

  it('tema novo só nasce de sinal positivo', () => {
    expect(applyInterestSignal(null, 'MATERIAL_GENERATED')).toBe(
      LEARNED_INTEREST_START + 5,
    );
    expect(applyInterestSignal(null, 'MATERIAL_ABANDONED')).toBeNull();
  });
});
