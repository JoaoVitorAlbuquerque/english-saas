import type { CefrLevel, Competency } from '@english-saas/shared';

import { thetaToLevel } from 'src/modules/learner-model/domain/competency-level';

import {
  CALIBRATION_RULES,
  calibrateItem,
  pointBiserialOf,
} from './domain/calibration';
import {
  checkpointOutcome,
  checkpointShouldStop,
  nextCheckpointItem,
  type CheckpointCandidate,
  type CheckpointResponse,
} from './domain/checkpoint';
import { difficultyForP, estimateEap, probability } from './domain/irt';
import {
  canRetake,
  currentEstimate,
  nextPlacementItem,
  PLACEMENT_COMPETENCIES,
  PLACEMENT_RULES,
  placementResult,
  retakeAvailableAt,
  startLevelFor,
  stopReason,
  type PlacementCandidate,
  type PlacementResponse,
} from './domain/placement';
import { selectLeveledItems } from './domain/select-items';

/** PRNG com semente (mulberry32): `domain/` recebe a aleatoriedade de fora. */
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

/** Banco sintético: 400 itens de −3 a +3, nas quatro competências. */
function syntheticBank(seed = 99, size = 400): PlacementCandidate[] {
  const random = seeded(seed);
  return Array.from({ length: size }, (_, index) => ({
    id: `item-${String(index).padStart(3, '0')}`,
    difficulty: -3 + 6 * random(),
    competency: PLACEMENT_COMPETENCIES[index % 4] as Competency,
    exposureCount: Math.floor(random() * 100),
  }));
}

const LEVEL_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const bandDistance = (a: CefrLevel, b: CefrLevel) =>
  Math.abs(LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));

/** Um aluno com theta verdadeiro conhecido faz o nivelamento inteiro. */
function simulatePlacement(
  trueTheta: number,
  startLevel: CefrLevel,
  seed: number,
  bank: readonly PlacementCandidate[],
) {
  const random = seeded(seed);
  const served = new Set<string>();
  const responses: PlacementResponse[] = [];
  let estimate = currentEstimate([], startLevel);
  let next = nextPlacementItem({
    candidates: bank,
    servedItemIds: served,
    theta: estimate.theta,
    answered: 0,
    random,
  });

  while (next !== null) {
    served.add(next.id);
    responses.push({
      difficulty: next.difficulty,
      competency: next.competency,
      correct: random() < probability(trueTheta, next.difficulty),
    });
    estimate = currentEstimate(responses, startLevel);
    next = nextPlacementItem({
      candidates: bank,
      servedItemIds: served,
      theta: estimate.theta,
      answered: responses.length,
      random,
    });

    if (
      stopReason({
        answered: responses.length,
        standardError: estimate.standardError,
        hasNextItem: next !== null,
      }) !== null
    ) {
      break;
    }
  }

  return {
    level: thetaToLevel(estimate.theta),
    items: responses.length,
    served,
    responses,
  };
}

// ---------------------------------------------------------------------------

describe('irt', () => {
  it('Rasch: 50% quando theta iguala a dificuldade', () => {
    expect(probability(1, 1)).toBe(0.5);
    expect(difficultyForP(0, 0.7)).toBeCloseTo(-0.847, 3);
    expect(probability(0, difficultyForP(0, 0.7))).toBeCloseTo(0.7, 5);
  });

  it('EAP com tudo certo fica finita — onde a máxima verossimilhança fugiria', () => {
    const allCorrect = Array.from({ length: 10 }, () => ({
      difficulty: 0,
      correct: true,
    }));
    const estimate = estimateEap(allCorrect, { mean: 0, sd: 1.5 });

    expect(Number.isFinite(estimate.theta)).toBe(true);
    expect(estimate.theta).toBeGreaterThan(1);
    expect(estimate.theta).toBeLessThan(4);
  });

  it('o erro padrão cai a cada resposta', () => {
    let previous = Number.POSITIVE_INFINITY;

    for (let n = 0; n <= 20; n += 5) {
      const responses = Array.from({ length: n }, (_, index) => ({
        difficulty: 0,
        correct: index % 2 === 0,
      }));
      const { standardError } = estimateEap(responses, { mean: 0, sd: 1.5 });

      expect(standardError).toBeLessThan(previous);
      previous = standardError;
    }
  });

  it('converge para o theta verdadeiro com muitas respostas', () => {
    const random = seeded(7);
    const responses = Array.from({ length: 300 }, () => {
      const difficulty = 0.8 + (random() * 2 - 1);
      return { difficulty, correct: random() < probability(0.8, difficulty) };
    });

    expect(estimateEap(responses, { mean: -2, sd: 1.5 }).theta).toBeCloseTo(
      0.8,
      0,
    );
  });
});

// ---------------------------------------------------------------------------

describe('placement — regras', () => {
  it('nível de partida pelo autodeclarado', () => {
    expect(startLevelFor('NONE')).toBe('A1');
    expect(startLevelFor('BASIC')).toBe('A2');
    expect(startLevelFor('INTERMEDIATE')).toBe('B1');
    expect(startLevelFor('ADVANCED')).toBe('B2');
    expect(startLevelFor(null)).toBe('A1');
  });

  it('parada: nunca antes de 12, precisão, 30 itens ou banco esgotado', () => {
    expect(
      stopReason({ answered: 11, standardError: 0.1, hasNextItem: true }),
    ).toBeNull();
    expect(
      stopReason({ answered: 12, standardError: 0.34, hasNextItem: true }),
    ).toBe('PRECISION');
    expect(
      stopReason({ answered: 20, standardError: 0.4, hasNextItem: true }),
    ).toBeNull();
    expect(
      stopReason({ answered: 30, standardError: 0.5, hasNextItem: true }),
    ).toBe('MAX_ITEMS');
    expect(
      stopReason({ answered: 5, standardError: 0.9, hasNextItem: false }),
    ).toBe('BANK_EXHAUSTED');
  });

  it('refazer só 60 dias depois', () => {
    const done = new Date('2026-09-01T12:00:00Z');

    expect(canRetake(null, done)).toBe(true);
    expect(canRetake(done, new Date('2026-10-30T12:00:00Z'))).toBe(false);
    expect(canRetake(done, new Date('2026-10-31T12:00:00Z'))).toBe(true);
    expect(retakeAvailableAt(done)?.toISOString()).toBe(
      '2026-10-31T12:00:00.000Z',
    );
  });
});

describe('placement — seleção', () => {
  const bank = syntheticBank();

  it('não repete item num teste inteiro', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const run = simulatePlacement(0, 'B1', seed, bank);
      expect(run.served.size).toBe(run.items);
    }
  });

  it('alterna as quatro competências', () => {
    const run = simulatePlacement(0, 'B1', 3, bank);

    expect(
      run.responses.slice(0, 8).map((response) => response.competency),
    ).toEqual([...PLACEMENT_COMPETENCIES, ...PLACEMENT_COMPETENCIES]);
  });

  it('pula a competência que não tem item', () => {
    const noReading = bank.filter((item) => item.competency !== 'READING');
    const run = simulatePlacement(0, 'B1', 4, noReading);

    expect(
      run.responses.some((response) => response.competency === 'READING'),
    ).toBe(false);
    expect(run.items).toBe(PLACEMENT_RULES.maxItems);
  });

  it('entre dois itens igualmente perto, prefere o menos exposto', () => {
    const pair: PlacementCandidate[] = [
      {
        id: 'b-exposed',
        difficulty: 0.2,
        competency: 'GRAMMAR',
        exposureCount: 900,
      },
      {
        id: 'a-fresh',
        difficulty: -0.2,
        competency: 'GRAMMAR',
        exposureCount: 10,
      },
    ];

    expect(
      nextPlacementItem({
        candidates: pair,
        servedItemIds: new Set(),
        theta: 0,
        answered: 0,
        random: () => 0,
      })?.id,
    ).toBe('a-fresh');
  });

  it('mesma semente, mesmo teste', () => {
    const a = simulatePlacement(0.3, 'A2', 11, bank);
    const b = simulatePlacement(0.3, 'A2', 11, bank);

    expect([...a.served]).toEqual([...b.served]);
  });

  it('banco pequeno termina por esgotamento', () => {
    const tiny = bank.slice(0, 8);
    const run = simulatePlacement(0, 'B1', 5, tiny);

    expect(run.items).toBe(8);
  });
});

describe('placement — simulação de alunos com nível conhecido', () => {
  const bank = syntheticBank();
  const starts: CefrLevel[] = ['A1', 'A2', 'B1', 'B2'];
  const RUNS = 500;

  /** Centro de cada faixa; A1 e C1 são abertas, então ±0.5 da borda. */
  const bands: { level: CefrLevel; theta: number }[] = [
    { level: 'A1', theta: -2 },
    { level: 'A2', theta: -1 },
    { level: 'B1', theta: 0 },
    { level: 'B2', theta: 1 },
    { level: 'C1', theta: 2 },
  ];

  const outcomes = bands.map(({ level, theta }) => {
    const runs = Array.from({ length: RUNS }, (_, index) =>
      simulatePlacement(
        theta,
        starts[index % starts.length] as CefrLevel,
        index * 7 + Math.round(theta * 1_000) + 10_000,
        bank,
      ),
    );

    return {
      level,
      exact: runs.filter((run) => run.level === level).length / RUNS,
      withinOne:
        runs.filter((run) => bandDistance(run.level, level) <= 1).length / RUNS,
      maxItems: Math.max(...runs.map((run) => run.items)),
    };
  });

  if (process.env['PRINT_SIMULATION'] === '1') {
    // Números reais para o relatório — não roda na suíte normal.
    console.warn(JSON.stringify(outcomes, null, 2));
  }

  it('acerta a faixa CEFR exata em ≥ 80% das simulações', () => {
    const overall =
      outcomes.reduce((sum, outcome) => sum + outcome.exact, 0) /
      outcomes.length;

    expect(overall).toBeGreaterThanOrEqual(0.8);
  });

  it('nenhuma faixa fica muito atrás (≥ 75%)', () => {
    for (const outcome of outcomes) {
      expect(outcome.exact).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('critério de pronto: aluno B1 termina em B1 ± 1 faixa, em até 30 itens', () => {
    const b1 = outcomes.find((outcome) => outcome.level === 'B1');

    expect(b1?.withinOne).toBeGreaterThanOrEqual(0.99);
    expect(b1?.maxItems).toBeLessThanOrEqual(30);
  });
});

describe('placement — resultado', () => {
  const skills = [
    {
      id: 'a1-grammar',
      competency: 'GRAMMAR' as const,
      cefrLevel: 'A1' as const,
    },
    {
      id: 'a2-grammar',
      competency: 'GRAMMAR' as const,
      cefrLevel: 'A2' as const,
    },
    {
      id: 'a1-speaking',
      competency: 'SPEAKING' as const,
      cefrLevel: 'A1' as const,
    },
  ];

  it('aluno B1: A1 dominada, A2 não; competência sem item usa o geral', () => {
    const random = seeded(21);
    const responses: PlacementResponse[] = Array.from(
      { length: 30 },
      (_, index) => {
        const difficulty = -1 + 2 * random();
        return {
          difficulty,
          competency: PLACEMENT_COMPETENCIES[index % 4] as Competency,
          correct: random() < probability(0, difficulty),
        };
      },
    );

    const result = placementResult({ responses, startLevel: 'B1', skills });

    expect(result.overallLevel).toBe(thetaToLevel(result.theta));
    expect(Object.keys(result.levelsByCompetency).sort()).toEqual(
      [...PLACEMENT_COMPETENCIES].sort(),
    );
    expect(result.levelsByCompetency.GRAMMAR?.items).toBe(8);
    // Competência puxada para o geral: não se afasta muito com ~7 itens.
    expect(
      Math.abs((result.levelsByCompetency.GRAMMAR?.theta ?? 99) - result.theta),
    ).toBeLessThan(1);

    if (result.theta > -0.6 && result.theta < 0.6) {
      expect(result.masteredSkillIds).toContain('a1-grammar');
      expect(result.masteredSkillIds).toContain('a1-speaking');
      expect(result.masteredSkillIds).not.toContain('a2-grammar');
    }
  });
});

// ---------------------------------------------------------------------------

describe('checkpoint', () => {
  const candidates: CheckpointCandidate[] = [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `unit-a-${String(index)}`,
      difficulty: -2 + index * 0.2,
      exposureCount: 0,
      skillIds: ['unit-a'],
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `unit-b-${String(index)}`,
      difficulty: -2 + index * 0.2,
      exposureCount: 0,
      skillIds: ['unit-b'],
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `weak-${String(index)}`,
      difficulty: -2 + index * 0.2,
      exposureCount: 0,
      skillIds: ['weak'],
    })),
  ];
  const priors = new Map([
    ['unit-a', -2],
    ['unit-b', -2],
    ['weak', -2.5],
  ]);

  it('começa pela skill da unidade e reveza pela que tem menos respostas', () => {
    const first = nextCheckpointItem({
      candidates,
      servedItemIds: new Set(),
      targetSkillIds: ['unit-a', 'unit-b'],
      weakSkillIds: ['weak'],
      responses: [],
      priorThetas: priors,
      random: () => 0,
    });
    const second = nextCheckpointItem({
      candidates,
      servedItemIds: new Set([first?.item.id ?? '']),
      targetSkillIds: ['unit-a', 'unit-b'],
      weakSkillIds: ['weak'],
      responses: [{ difficulty: -2, correct: true, skillIds: ['unit-a'] }],
      priorThetas: priors,
      random: () => 0,
    });

    expect(first?.skillId).toBe('unit-a');
    expect(second?.skillId).toBe('unit-b');
  });

  it('para com 10 e duas por skill da unidade; nunca passa de 15', () => {
    const response = (skill: string): CheckpointResponse => ({
      difficulty: -2,
      correct: true,
      skillIds: [skill],
    });
    const covered = [
      ...Array.from({ length: 5 }, () => response('unit-a')),
      ...Array.from({ length: 5 }, () => response('unit-b')),
    ];
    const lopsided = Array.from({ length: 10 }, () => response('unit-a'));

    const stop = (responses: CheckpointResponse[], hasNextItem = true) =>
      checkpointShouldStop({
        answered: responses.length,
        targetSkillIds: ['unit-a', 'unit-b'],
        responses,
        hasNextItem,
      });

    expect(stop(covered.slice(0, 9))).toBe(false);
    expect(stop(covered)).toBe(true);
    expect(stop(lopsided)).toBe(false);
    expect(stop([...lopsided, ...lopsided].slice(0, 15))).toBe(true);
    expect(stop(covered.slice(0, 3), false)).toBe(true);
  });

  const outcomeFor = (hits: Record<string, boolean[]>) =>
    checkpointOutcome({
      responses: Object.entries(hits).flatMap(([skill, answers]) =>
        answers.map((correct) => ({
          difficulty: -2,
          correct,
          skillIds: [skill],
        })),
      ),
      targetSkillIds: ['unit-a', 'unit-b'],
      weakSkillIds: ['weak'],
      priorThetas: new Map([
        ['unit-a', -2],
        ['unit-b', -2],
        ['weak', -2],
      ]),
      unitLevel: 'A1',
    });

  it('aprovado: tudo firme', () => {
    const outcome = outcomeFor({
      'unit-a': [true, true, true, true, true],
      'unit-b': [true, true, true, true, true],
      weak: [true, true, true],
    });

    expect(outcome.result).toBe('PASSED');
    expect(outcome.reinforceSkillIds).toEqual([]);
  });

  it('aprovado com reforço: foi bem, mas uma skill ficou abaixo', () => {
    const outcome = outcomeFor({
      'unit-a': [true, true, true, true, true],
      'unit-b': [true, true, true, true, true],
      weak: [false, false, false],
    });

    expect(outcome.result).toBe('PASSED_WITH_REINFORCEMENT');
    expect(outcome.reinforceSkillIds).toEqual(['weak']);
    expect(outcome.score).toBeCloseTo(10 / 13, 3);
  });

  it('reforço necessário: acerto geral baixo', () => {
    const outcome = outcomeFor({
      'unit-a': [false, false, true, false, false],
      'unit-b': [false, true, false, false, false],
      weak: [false, false, true],
    });

    expect(outcome.result).toBe('NEEDS_REINFORCEMENT');
    expect(outcome.reinforceSkillIds).toEqual(['unit-a', 'unit-b', 'weak']);
  });
});

// ---------------------------------------------------------------------------

describe('selectItems', () => {
  const bank = syntheticBank(5, 600).map((item, index) => ({
    ...item,
    skillIds: [index % 2 === 0 ? 'skill-x' : 'skill-y'],
  }));

  it('mira ~70% de acerto, reveza as skills e não repete', () => {
    const picked = selectLeveledItems({
      candidates: bank,
      skills: [
        { skillId: 'skill-x', theta: 0.5 },
        { skillId: 'skill-y', theta: -1 },
      ],
      count: 10,
      random: seeded(1),
    });

    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((item) => item.itemId)).size).toBe(10);
    expect(picked.map((item) => item.skillId).slice(0, 4)).toEqual([
      'skill-x',
      'skill-y',
      'skill-x',
      'skill-y',
    ]);
    for (const item of picked) {
      expect(item.predictedP).toBeGreaterThan(0.62);
      expect(item.predictedP).toBeLessThan(0.78);
    }
  });

  it('respeita os excluídos e para quando acaba o banco da skill', () => {
    const small = bank
      .filter((item) => item.skillIds[0] === 'skill-x')
      .slice(0, 3);
    const picked = selectLeveledItems({
      candidates: small,
      skills: [{ skillId: 'skill-x', theta: 0 }],
      count: 10,
      excludeItemIds: new Set([small[0]?.id ?? '']),
      random: seeded(2),
    });

    expect(picked.map((item) => item.itemId).sort()).toEqual(
      [small[1]?.id, small[2]?.id].sort(),
    );
  });
});

// ---------------------------------------------------------------------------

describe('calibration', () => {
  const responsesOf = (
    n: number,
    rule: (ability: number, index: number) => boolean,
  ) =>
    Array.from({ length: n }, (_, index) => {
      const ability = -2 + (4 * index) / n;
      return { ability, correct: rule(ability, index) };
    });

  it('não calibra abaixo de 50 respostas', () => {
    expect(
      calibrateItem({
        currentDifficulty: 0,
        responses: responsesOf(CALIBRATION_RULES.minResponses - 1, () => true),
      }),
    ).toBeNull();
  });

  it('anda devagar: no máximo 0.5 por rodada', () => {
    const result = calibrateItem({
      currentDifficulty: 0,
      responses: responsesOf(60, (_, index) => index % 50 === 0),
    });

    expect(result?.estimatedDifficulty).toBeGreaterThan(2);
    expect(result?.appliedDifficulty).toBe(0.5);
  });

  it('passo de 30% quando a diferença é pequena', () => {
    const result = calibrateItem({
      currentDifficulty: 0,
      responses: responsesOf(100, (ability) => ability > 0.4),
    });

    const expected = 0.3 * (result?.estimatedDifficulty ?? 0);
    expect(result?.appliedDifficulty).toBeCloseTo(expected, 3);
  });

  it('marca fácil demais, difícil demais e discriminação baixa', () => {
    const easy = calibrateItem({
      currentDifficulty: -2,
      responses: responsesOf(60, (_, index) => index !== 0),
    });
    const hard = calibrateItem({
      currentDifficulty: 2,
      responses: responsesOf(60, (_, index) => index < 3),
    });
    const noise = calibrateItem({
      currentDifficulty: 0,
      responses: responsesOf(60, (_, index) => index % 2 === 0),
    });
    const good = calibrateItem({
      currentDifficulty: 0,
      responses: responsesOf(60, (ability) => ability > 0),
    });

    expect(easy?.flags).toContain('TOO_EASY');
    expect(hard?.flags).toContain('TOO_HARD');
    expect(noise?.flags).toEqual(['LOW_DISCRIMINATION']);
    expect(good?.flags).toEqual([]);
  });

  it('point-biserial: sem variação, não inventa número', () => {
    expect(pointBiserialOf(responsesOf(10, () => true))).toBeNull();
    expect(
      pointBiserialOf(responsesOf(10, (ability) => ability > 0)),
    ).toBeGreaterThan(0.7);
  });
});
