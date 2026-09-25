import {
  feedbackFromCorrection,
  sanitizeCorrection,
  type CorrectionOutput,
  type Fix,
} from './domain/correction';
import {
  applyTurn,
  buildSummary,
  canTakeTurn,
  feedbackFromRoleplay,
  turnLimit,
  type RoleplayGoal,
  type TurnFeedback,
} from './domain/roleplay';

function fix(overrides: Partial<Fix> = {}): Fix {
  return {
    original: 'I have 22 years',
    suggestion: "I'm 22 years old",
    explanationPtBr: 'Idade é com "to be".',
    errorPatternId: 'l1.have-for-age',
    skillId: 'grammar.be.present.affirmative',
    severity: 'MAJOR',
    ...overrides,
  };
}

function output(overrides: Partial<CorrectionOutput> = {}): CorrectionOutput {
  return {
    safety: 'OK',
    corrected: "I'm 22 years old.",
    fixes: [fix()],
    rubric: [],
    registerTips: [],
    encouragement: 'Boa!',
    estimatedLevel: 'A1',
    ...overrides,
  };
}

describe('tutor — correção', () => {
  const allowed = {
    errorPatternIds: new Set(['l1.have-for-age', 'article.country-the']),
    skillIds: new Set(['grammar.be.present.affirmative']),
    rubricIds: new Set(['says-name', 'no-have-for-age']),
  };

  it('descarta id que a IA inventou, sem perder a correção', () => {
    const clean = sanitizeCorrection(
      output({
        fixes: [
          fix({ errorPatternId: 'l1.invented', skillId: 'skill.invented' }),
        ],
        rubric: [
          { goalId: 'says-name', met: true, comment: '' },
          { goalId: 'made-up-goal', met: false, comment: '' },
          { goalId: 'says-name', met: false, comment: 'duplicado' },
        ],
      }),
      allowed,
    );

    expect(clean.fixes[0]).toMatchObject({
      errorPatternId: null,
      skillId: null,
      suggestion: "I'm 22 years old",
    });
    expect(clean.rubric).toEqual([
      { goalId: 'says-name', met: true, comment: '' },
    ]);
  });

  it('mapeia os erros para ErrorPatterns, cada um uma vez, com a frase real', () => {
    const feedback = feedbackFromCorrection({
      output: output({
        fixes: [
          fix(),
          fix({ original: 'I has 30 years' }),
          fix({
            original: 'in the Recife',
            suggestion: 'in Recife',
            errorPatternId: 'article.country-the',
            skillId: null,
          }),
          fix({
            original: 'i am',
            errorPatternId: null,
            skillId: null,
            severity: 'MINOR',
          }),
        ],
      }),
      rubric: [],
    });

    expect(feedback.errorPatterns).toEqual([
      {
        id: 'l1.have-for-age',
        text: 'I have 22 years',
        correction: "I'm 22 years old",
      },
      {
        id: 'article.country-the',
        text: 'in the Recife',
        correction: 'in Recife',
      },
    ]);
  });

  it('erro que a rubrica vigiava e não apareceu conta como oportunidade sem erro', () => {
    const feedback = feedbackFromCorrection({
      output: output({
        fixes: [],
        rubric: [{ goalId: 'no-have-for-age', met: true, comment: '' }],
      }),
      rubric: [
        {
          id: 'no-have-for-age',
          skillId: 'grammar.be.present.affirmative',
          errorPatternId: 'l1.have-for-age',
        },
      ],
    });

    expect(feedback.errorPatterns).toEqual([]);
    expect(feedback.checkedErrorPatternIds).toEqual(['l1.have-for-age']);
    expect(feedback.skills).toEqual([
      { skillId: 'grammar.be.present.affirmative', met: true },
    ]);
  });

  it('correção MAJOR numa skill vale mais que a rubrica dizendo que cumpriu', () => {
    const feedback = feedbackFromCorrection({
      output: output({
        rubric: [{ goalId: 'no-have-for-age', met: true, comment: '' }],
      }),
      rubric: [
        {
          id: 'no-have-for-age',
          skillId: 'grammar.be.present.affirmative',
          errorPatternId: 'l1.have-for-age',
        },
      ],
    });

    expect(feedback.skills).toEqual([
      { skillId: 'grammar.be.present.affirmative', met: false },
    ]);
  });
});

describe('tutor — roleplay', () => {
  const goals: RoleplayGoal[] = [
    { id: 'tell-name', description: 'Nome', skillIds: ['chunk.my-name-is'] },
    {
      id: 'tell-origin',
      description: 'Origem',
      skillIds: ['chunk.where-are-you-from'],
    },
  ];
  const state = {
    goals,
    goalsMet: [] as string[],
    studentTurns: 1,
    maxTurns: 6,
    strikes: 0,
  };
  const ok = {
    safety: 'OK' as const,
    goalsMet: [] as string[],
    isFinished: false,
  };

  it('turnos: o menor entre a etapa e o plano', () => {
    expect(turnLimit(10, 6)).toBe(6);
    expect(turnLimit(10, 40)).toBe(10);
    expect(
      canTakeTurn({ status: 'ACTIVE', studentTurns: 6, maxTurns: 6 }),
    ).toBe(false);
    expect(
      canTakeTurn({ status: 'ACTIVE', studentTurns: 5, maxTurns: 6 }),
    ).toBe(true);
    expect(
      canTakeTurn({ status: 'FINISHED', studentTurns: 0, maxTurns: 6 }),
    ).toBe(false);
  });

  it('acumula metas e só aceita meta que existe', () => {
    const first = applyTurn(state, {
      ...ok,
      goalsMet: ['tell-name', 'made-up'],
    });
    expect(first).toEqual({
      goalsMet: ['tell-name'],
      strikes: 0,
      finished: null,
    });

    const second = applyTurn(
      { ...state, goalsMet: first.goalsMet, studentTurns: 2 },
      { ...ok, goalsMet: ['tell-origin'] },
    );
    expect(second.finished).toBe('GOALS');
  });

  it('fora do cenário ou impróprio não cumpre meta; 2 strikes encerram', () => {
    expect(
      applyTurn(state, { ...ok, safety: 'OFF_TOPIC', goalsMet: ['tell-name'] })
        .goalsMet,
    ).toEqual([]);

    const strike = applyTurn(state, { ...ok, safety: 'INAPPROPRIATE' });
    expect(strike).toMatchObject({ strikes: 1, finished: null });
    expect(
      applyTurn({ ...state, strikes: 1 }, { ...ok, safety: 'INAPPROPRIATE' })
        .finished,
    ).toBe('STRIKES');
  });

  it('acaba quando os turnos acabam ou o personagem encerra', () => {
    expect(applyTurn({ ...state, studentTurns: 6 }, ok).finished).toBe('TURNS');
    expect(applyTurn(state, { ...ok, isFinished: true }).finished).toBe(
      'CHARACTER',
    );
  });

  const turns: TurnFeedback[] = [
    {
      inlineCorrection: {
        original: 'I am from the Brazil',
        suggestion: "I'm from Brazil",
        explanationPtBr: '',
        errorPatternId: null,
      },
      expressionSkillIds: ['chunk.my-name-is'],
    },
    {
      inlineCorrection: {
        original: 'I have 22 years',
        suggestion: "I'm 22",
        explanationPtBr: '',
        errorPatternId: 'l1.have-for-age',
      },
      expressionSkillIds: ['chunk.my-name-is', 'vocab.countries'],
    },
    {
      inlineCorrection: {
        original: 'I HAVE 22 years ',
        suggestion: "I'm 22",
        explanationPtBr: '',
        errorPatternId: 'l1.have-for-age',
      },
      expressionSkillIds: [],
    },
    { inlineCorrection: null, expressionSkillIds: [] },
    {
      inlineCorrection: {
        original: 'He live here',
        suggestion: 'He lives here',
        explanationPtBr: '',
        errorPatternId: 'third-person-s',
      },
      expressionSkillIds: [],
    },
    {
      inlineCorrection: {
        original: 'yes I am',
        suggestion: 'Yes, I am',
        explanationPtBr: '',
        errorPatternId: null,
      },
      expressionSkillIds: [],
    },
  ];

  it('resumo: 3 correções, primeiro as de erro típico, sem repetir trecho', () => {
    const summary = buildSummary({
      goals,
      goalsMet: ['tell-name'],
      turns,
      finishedBy: 'TURNS',
    });

    expect(summary.topCorrections.map((c) => c.original)).toEqual([
      'I have 22 years',
      'He live here',
      'I am from the Brazil',
    ]);
    expect(summary.expressionSkillIds).toEqual([
      'chunk.my-name-is',
      'vocab.countries',
    ]);
    expect(summary.goals).toEqual([
      { id: 'tell-name', description: 'Nome', met: true },
      { id: 'tell-origin', description: 'Origem', met: false },
    ]);
  });

  it('feedback do roleplay: só meta cumprida vira evidência', () => {
    const summary = buildSummary({
      goals,
      goalsMet: ['tell-name'],
      turns,
      finishedBy: 'TURNS',
    });
    const feedback = feedbackFromRoleplay({ summary, goals, turns });

    expect(feedback.skills).toEqual([
      { skillId: 'chunk.my-name-is', met: true },
    ]);
    expect(feedback.errorPatterns.map((e) => e.id)).toEqual([
      'l1.have-for-age',
      'third-person-s',
    ]);
    expect(feedback.expressionSkillIds).toEqual([
      'chunk.my-name-is',
      'vocab.countries',
    ]);
  });
});
