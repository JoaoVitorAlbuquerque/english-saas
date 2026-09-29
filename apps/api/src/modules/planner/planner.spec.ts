import type { AvailabilityMinutes } from '@english-saas/shared';

import {
  buildAgenda,
  type NextLessonCandidate,
  type PracticeCandidate,
  type ReviewCandidate,
} from './domain/build-agenda';
import {
  buildPath,
  type CourseLesson,
  type MasteryBySkill,
  type SkillNode,
} from './domain/build-path';
import { needsRecalculation, weeksBehind } from './domain/pacing';

const NOW = new Date('2026-01-05T12:00:00.000Z'); // uma segunda-feira

function availability(
  overrides: Partial<AvailabilityMinutes> = {},
): AvailabilityMinutes {
  return {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
    ...overrides,
  };
}

function lesson(
  overrides: Partial<CourseLesson> & Pick<CourseLesson, 'lessonId' | 'unitId'>,
): CourseLesson {
  return {
    slug: overrides.lessonId,
    title: overrides.lessonId,
    cefrLevel: 'A1',
    estimatedMinutes: 15,
    targetSkillIds: [],
    ...overrides,
  };
}

describe('buildPath', () => {
  const greet: SkillNode = {
    id: 'skill.greet',
    cefrLevel: 'A1',
    goals: [],
    prerequisiteIds: [],
  };

  function basePath(input: Partial<Parameters<typeof buildPath>[0]> = {}) {
    return buildPath({
      courseLessons: [],
      skillGraph: new Map(),
      masteryBySkill: new Map(),
      weaknessSkillIds: [],
      goals: [],
      startLevel: 'A1',
      targetLevel: 'A1',
      targetDate: null,
      availabilityMinutes: availability({
        mon: 60,
        tue: 60,
        wed: 60,
        thu: 60,
        fri: 60,
      }),
      now: NOW,
      ...input,
    });
  }

  it('pula lição cujas target skills já estão dominadas', () => {
    const mastered = lesson({
      lessonId: 'l1',
      unitId: 'u1',
      targetSkillIds: ['skill.greet'],
    });
    const mastery: MasteryBySkill = new Map([
      ['skill.greet', { mastery: 0.9, evidence: 10 }],
    ]);

    const result = basePath({
      courseLessons: [mastered],
      skillGraph: new Map([['skill.greet', greet]]),
      masteryBySkill: mastery,
    });

    expect(result.path).toHaveLength(0);
  });

  it('mantém lição com skill não dominada ou nunca praticada', () => {
    const notMastered = lesson({
      lessonId: 'l1',
      unitId: 'u1',
      targetSkillIds: ['skill.greet'],
    });

    const result = basePath({
      courseLessons: [notMastered],
      skillGraph: new Map([['skill.greet', greet]]),
      masteryBySkill: new Map(), // nunca praticada
    });

    expect(result.path.map((entry) => entry.lessonId)).toEqual(['l1']);
  });

  it('respeita a faixa de nível entre início e alvo', () => {
    const a1 = lesson({ lessonId: 'l1', unitId: 'u1', cefrLevel: 'A1' });
    const a2 = lesson({ lessonId: 'l2', unitId: 'u2', cefrLevel: 'A2' });
    const b1 = lesson({ lessonId: 'l3', unitId: 'u3', cefrLevel: 'B1' });

    const result = basePath({
      courseLessons: [a1, a2, b1],
      startLevel: 'A2',
      targetLevel: 'A2',
    });

    expect(result.path.map((entry) => entry.lessonId)).toEqual(['l2']);
  });

  it('objetivo WORK promove a unidade ligada a ele, sem furar pré-requisito', () => {
    const generic = lesson({
      lessonId: 'generic',
      unitId: 'u-generic',
      targetSkillIds: ['skill.greet'],
    });
    const work = lesson({
      lessonId: 'work',
      unitId: 'u-work',
      targetSkillIds: ['skill.work'],
    });
    const skillGraph = new Map<string, SkillNode>([
      ['skill.greet', greet],
      [
        'skill.work',
        {
          id: 'skill.work',
          cefrLevel: 'A1',
          goals: ['WORK'],
          prerequisiteIds: [],
        },
      ],
    ]);

    const result = basePath({
      courseLessons: [generic, work],
      skillGraph,
      goals: ['WORK'],
    });

    expect(result.path.map((entry) => entry.lessonId)).toEqual([
      'work',
      'generic',
    ]);
    expect(result.path[0]?.reason).toContain('objetivo');
  });

  it('não promove a lição do objetivo na frente de quem ensina o pré-requisito dela', () => {
    const generic = lesson({
      lessonId: 'generic',
      unitId: 'u-generic',
      targetSkillIds: ['skill.greet'],
    });
    const work = lesson({
      lessonId: 'work',
      unitId: 'u-work',
      targetSkillIds: ['skill.work'],
    });
    const skillGraph = new Map<string, SkillNode>([
      ['skill.greet', greet],
      [
        'skill.work',
        {
          id: 'skill.work',
          cefrLevel: 'A1',
          goals: ['WORK'],
          prerequisiteIds: ['skill.greet'],
        },
      ],
    ]);

    const result = basePath({
      courseLessons: [generic, work],
      skillGraph,
      goals: ['WORK'],
    });

    expect(result.path.map((entry) => entry.lessonId)).toEqual([
      'generic',
      'work',
    ]);
  });

  it('reforço só entra se o pré-requisito da fraqueza já está dominado', () => {
    const travel: SkillNode = {
      id: 'skill.travel',
      cefrLevel: 'A2',
      goals: [],
      prerequisiteIds: ['skill.greet'],
    };

    const readyResult = basePath({
      skillGraph: new Map([
        ['skill.greet', greet],
        ['skill.travel', travel],
      ]),
      masteryBySkill: new Map([['skill.greet', { mastery: 0.9, evidence: 8 }]]),
      weaknessSkillIds: ['skill.travel'],
    });
    expect(readyResult.reinforceSkillIds).toEqual(['skill.travel']);

    const notReadyResult = basePath({
      skillGraph: new Map([
        ['skill.greet', greet],
        ['skill.travel', travel],
      ]),
      masteryBySkill: new Map([['skill.greet', { mastery: 0.2, evidence: 8 }]]),
      weaknessSkillIds: ['skill.travel'],
    });
    expect(notReadyResult.reinforceSkillIds).toEqual([]);
  });

  it('forecast: muito tempo disponível chega bem antes de pouco tempo', () => {
    const lessons = [
      lesson({ lessonId: 'l1', unitId: 'u1', estimatedMinutes: 60 }),
      lesson({ lessonId: 'l2', unitId: 'u1', estimatedMinutes: 60 }),
    ];

    const lots = basePath({
      courseLessons: lessons,
      availabilityMinutes: availability({
        mon: 60,
        tue: 60,
        wed: 60,
        thu: 60,
        fri: 60,
        sat: 60,
        sun: 60,
      }),
    });
    const little = basePath({
      courseLessons: lessons,
      availabilityMinutes: availability({ mon: 20 }),
    });

    expect(lots.forecast.estimatedArrival).not.toBeNull();
    expect(little.forecast.estimatedArrival).not.toBeNull();
    expect(
      new Date(lots.forecast.estimatedArrival as string).getTime(),
    ).toBeLessThan(
      new Date(little.forecast.estimatedArrival as string).getTime(),
    );
  });

  it('forecast não realista quando o ritmo não bate a targetDate', () => {
    const result = basePath({
      courseLessons: [
        lesson({ lessonId: 'l1', unitId: 'u1', estimatedMinutes: 600 }),
      ],
      availabilityMinutes: availability({ mon: 10 }),
      targetDate: new Date('2026-01-10T00:00:00.000Z'),
    });

    expect(result.forecast.realistic).toBe(false);
    expect(result.forecast.message).not.toBeNull();
  });

  it('forecast sem nenhum dia de estudo: sem chegada, sem realismo', () => {
    const result = basePath({
      courseLessons: [lesson({ lessonId: 'l1', unitId: 'u1' })],
      availabilityMinutes: availability(),
    });

    expect(result.forecast.estimatedArrival).toBeNull();
    expect(result.forecast.realistic).toBe(false);
  });
});

describe('buildAgenda', () => {
  const review: ReviewCandidate = {
    count: 5,
    estimatedMinutes: 6,
    hasRecurringError: true,
  };
  const nextLesson: NextLessonCandidate = {
    lessonId: 'l1',
    slug: 'l1',
    title: 'Lição 1',
    estimatedMinutes: 15,
    reason: 'Próxima da sua trilha.',
  };
  function practiceItem(id: string): PracticeCandidate['item'] {
    return {
      id,
      type: 'MULTIPLE_CHOICE',
      prompt: 'prompt',
      content: {},
      cefrLevel: 'A1',
      skillIds: [],
      assets: {},
    };
  }
  const practice: PracticeCandidate[] = [
    {
      itemId: 'i1',
      skillId: 's1',
      skillTitle: 'Skill 1',
      estimatedMinutes: 1.5,
      recentOccurrences: 3,
      item: practiceItem('i1'),
    },
    {
      itemId: 'i2',
      skillId: 's2',
      skillTitle: 'Skill 2',
      estimatedMinutes: 1.5,
      recentOccurrences: null,
      item: practiceItem('i2'),
    },
  ];

  it('orçamento pequeno: só cabe revisão', () => {
    const blocks = buildAgenda({
      budgetMinutes: 5,
      review,
      nextLesson,
      practice,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('REVIEW');
    expect(blocks[0]?.estimatedMinutes).toBeLessThanOrEqual(5);
  });

  it('orçamento grande: cabe revisão, lição e prática, dentro do total', () => {
    const blocks = buildAgenda({
      budgetMinutes: 60,
      review,
      nextLesson,
      practice,
    });

    expect(blocks.map((block) => block.type)).toEqual([
      'REVIEW',
      'LESSON',
      'PRACTICE',
      'PRACTICE',
    ]);
    const total = blocks.reduce(
      (sum, block) => sum + block.estimatedMinutes,
      0,
    );
    expect(total).toBeLessThanOrEqual(60);
  });

  it('sem cards vencidos: sem bloco de revisão', () => {
    const blocks = buildAgenda({
      budgetMinutes: 30,
      review: null,
      nextLesson,
      practice: [],
    });

    expect(blocks.every((block) => block.type !== 'REVIEW')).toBe(true);
  });

  it('sem próxima lição: pula direto pra prática', () => {
    const blocks = buildAgenda({
      budgetMinutes: 30,
      review: null,
      nextLesson: null,
      practice,
    });

    expect(blocks.every((block) => block.type !== 'LESSON')).toBe(true);
    expect(blocks.some((block) => block.type === 'PRACTICE')).toBe(true);
  });

  it('erro recorrente aparece na razão do bloco de revisão', () => {
    const blocks = buildAgenda({
      budgetMinutes: 30,
      review,
      nextLesson: null,
      practice: [],
    });
    expect(blocks[0]?.reason).toContain('recorrentes');
  });

  it('backlog grande de revisão nunca estoura o orçamento do dia — mesmo depois de vários dias perdidos', () => {
    // 3 dias sem agenda: o backlog de cards vencidos cresce, mas o corte
    // pelo tempo (já feito no SRS/9 antes de chegar aqui) é respeitado de
    // novo pelo `buildAgenda` — nunca estoura o dia.
    const hugeBacklog: ReviewCandidate = {
      count: 80,
      estimatedMinutes: 200,
      hasRecurringError: true,
    };

    const blocks = buildAgenda({
      budgetMinutes: 20,
      review: hugeBacklog,
      nextLesson,
      practice,
    });

    const total = blocks.reduce(
      (sum, block) => sum + block.estimatedMinutes,
      0,
    );
    expect(total).toBeLessThanOrEqual(20);
  });
});

describe('pacing', () => {
  const DAY_MS = 86_400_000;

  it('no prazo: sem semanas de atraso', () => {
    const weeks = weeksBehind({
      planCreatedAt: NOW,
      now: new Date(NOW.getTime() + 7 * DAY_MS),
      expectedWeeksTotal: 4,
      completedMinutes: 60,
      totalMinutesPlanned: 240,
    });

    expect(needsRecalculation(weeks)).toBe(false);
  });

  it('uma semana de atraso: passou de 25% do tempo sem 25% do progresso', () => {
    const weeks = weeksBehind({
      planCreatedAt: NOW,
      now: new Date(NOW.getTime() + 7 * DAY_MS), // 1 de 4 semanas: 25% esperado
      expectedWeeksTotal: 4,
      completedMinutes: 0, // nada feito
      totalMinutesPlanned: 240,
    });

    expect(needsRecalculation(weeks)).toBe(true);
  });

  it('várias semanas de atraso pesam mais que uma', () => {
    const oneWeek = weeksBehind({
      planCreatedAt: NOW,
      now: new Date(NOW.getTime() + 14 * DAY_MS),
      expectedWeeksTotal: 4,
      completedMinutes: 120,
      totalMinutesPlanned: 240,
    });
    const manyWeeks = weeksBehind({
      planCreatedAt: NOW,
      now: new Date(NOW.getTime() + 28 * DAY_MS),
      expectedWeeksTotal: 4,
      completedMinutes: 0,
      totalMinutesPlanned: 240,
    });

    expect(manyWeeks).toBeGreaterThan(oneWeek);
  });
});
