import { suggestAction, lessonBySkill, accuracyLabel } from './domain/actions';
import {
  buildDailyActivity,
  isActive,
  mergeTallies,
  SECONDS_PER_FLASHCARD,
} from './domain/activity';
import {
  addDays,
  dateRange,
  localDateOf,
  localDayBounds,
  recentWeeks,
  safeTimeZone,
  weekStart,
  weekdayKey,
} from './domain/dates';
import { paceForecast } from './domain/forecast';
import {
  abandonmentFunnel,
  activeUsers,
  cohortRetention,
  mergeDropoffs,
  monthlyRevenueCents,
  usdMicrosToBrlCents,
  worstLessons,
} from './domain/platform';
import {
  errorTrend,
  weeklyCompliance,
  weeklyLevelSeries,
} from './domain/trends';

const EMPTY_PARTS = {
  stepTimeMs: 0,
  practiceAnswerMs: 0,
  lessonsStarted: 0,
  lessonsCompleted: 0,
  answers: 0,
  firstTryAnswers: 0,
  firstTryCorrect: 0,
  byCompetency: {},
  reviewsDone: 0,
  flashcardReviews: 0,
  aiCalls: 0,
  aiCostUsdMicros: 0,
  plannedMinutes: 0,
};

describe('progress / dates', () => {
  it('soma dias e monta intervalos inclusivos', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(dateRange('2026-09-28', '2026-10-01')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('usa a segunda-feira como início da semana', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-21'); // domingo
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // segunda
    expect(recentWeeks('2026-09-30', 3)).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(weekdayKey('2026-09-28')).toBe('mon');
  });

  it('acha o intervalo UTC do dia local', () => {
    const { start, end } = localDayBounds('2026-09-26', 'America/Sao_Paulo');

    expect(start.toISOString()).toBe('2026-09-26T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-27T03:00:00.000Z');
  });

  it('respeita o horário de verão (dia de 23 horas)', () => {
    const { start, end } = localDayBounds('2026-03-08', 'America/New_York');

    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('23h30 em São Paulo ainda é o mesmo dia lá', () => {
    const instant = new Date('2026-09-27T02:30:00.000Z');

    expect(localDateOf(instant, 'America/Sao_Paulo')).toBe('2026-09-26');
    expect(localDateOf(instant, 'UTC')).toBe('2026-09-27');
  });

  it('fuso inválido cai no padrão', () => {
    expect(safeTimeZone('Marte/Olympus')).toBe('America/Sao_Paulo');
    expect(safeTimeZone('Europe/Lisbon')).toBe('Europe/Lisbon');
  });
});

describe('progress / activity', () => {
  it('soma lição, prática e revisão em segundos', () => {
    const row = buildDailyActivity({
      ...EMPTY_PARTS,
      stepTimeMs: 600_000,
      practiceAnswerMs: 30_400,
      flashcardReviews: 4,
      reviewsDone: 6,
    });

    expect(row.lessonSeconds).toBe(600);
    expect(row.practiceSeconds).toBe(30);
    expect(row.reviewSeconds).toBe(4 * SECONDS_PER_FLASHCARD);
    expect(row.studySeconds).toBe(730);
  });

  it('só planejar não conta como ativo; usar IA conta', () => {
    const planned = buildDailyActivity({ ...EMPTY_PARTS, plannedMinutes: 30 });
    const tutor = buildDailyActivity({ ...EMPTY_PARTS, aiCalls: 1 });

    expect(isActive(planned)).toBe(false);
    expect(isActive(tutor)).toBe(true);
  });

  it('junta o acerto por competência de vários dias', () => {
    expect(
      mergeTallies([
        { GRAMMAR: { answered: 3, correct: 2 } },
        {
          GRAMMAR: { answered: 1, correct: 1 },
          READING: { answered: 2, correct: 0 },
        },
      ]),
    ).toEqual({
      GRAMMAR: { answered: 4, correct: 3 },
      READING: { answered: 2, correct: 0 },
    });
  });
});

describe('progress / platform', () => {
  it('conta DAU, WAU e MAU nas bordas das janelas', () => {
    const days = [
      { userId: 'a', date: '2026-09-30' },
      { userId: 'a', date: '2026-09-29' },
      { userId: 'b', date: '2026-09-24' }, // 6 dias antes: dentro da semana
      { userId: 'c', date: '2026-09-23' }, // 7 dias antes: fora da semana
      { userId: 'd', date: '2026-09-01' }, // 29 dias antes: dentro do mês
      { userId: 'e', date: '2026-08-31' }, // 30 dias antes: fora
      { userId: 'f', date: '2026-10-01' }, // futuro: fora
    ];

    expect(activeUsers(days, '2026-09-30')).toEqual({ dau: 1, wau: 2, mau: 4 });
  });

  it('monta a retenção por coorte sem inventar semana futura', () => {
    const cells = cohortRetention({
      signups: [
        { userId: 'a', cohortWeek: '2026-09-14' },
        { userId: 'b', cohortWeek: '2026-09-14' },
        { userId: 'c', cohortWeek: '2026-09-21' },
      ],
      activeWeeks: [
        { userId: 'a', week: '2026-09-14' },
        { userId: 'b', week: '2026-09-14' },
        { userId: 'a', week: '2026-09-21' },
        { userId: 'c', week: '2026-09-28' },
      ],
      currentWeek: '2026-09-28',
    });

    expect(cells).toEqual([
      { cohortWeek: '2026-09-14', weekOffset: 0, cohortSize: 2, retained: 2 },
      { cohortWeek: '2026-09-14', weekOffset: 1, cohortSize: 2, retained: 1 },
      { cohortWeek: '2026-09-14', weekOffset: 2, cohortSize: 2, retained: 0 },
      { cohortWeek: '2026-09-21', weekOffset: 0, cohortSize: 1, retained: 0 },
      { cohortWeek: '2026-09-21', weekOffset: 1, cohortSize: 1, retained: 1 },
    ]);
  });

  it('agrupa o abandono pela etapa em que o aluno parou', () => {
    const funnel = abandonmentFunnel([
      { lessonId: 'l1', stepIndex: 2, stepType: 'recognize' },
      { lessonId: 'l1', stepIndex: 0, stepType: 'scene' },
      { lessonId: 'l1', stepIndex: 2, stepType: 'recognize' },
      { lessonId: 'l2', stepIndex: 1, stepType: 'explanation' },
    ]);

    expect(funnel.get('l1')).toEqual({
      abandoned: 3,
      byStep: [
        { stepIndex: 0, stepType: 'scene', count: 1 },
        { stepIndex: 2, stepType: 'recognize', count: 2 },
      ],
    });
    expect(
      mergeDropoffs([
        funnel.get('l1')?.byStep ?? [],
        [{ stepIndex: 0, stepType: 'scene', count: 4 }],
      ]),
    ).toEqual([
      { stepIndex: 0, stepType: 'scene', count: 5 },
      { stepIndex: 2, stepType: 'recognize', count: 2 },
    ]);
  });

  it('ordena as piores lições e ignora quem tem pouco volume', () => {
    const base = { firstTryAnswers: 10, abandoned: 0 };
    const worst = worstLessons([
      {
        ...base,
        lessonId: 'good',
        started: 20,
        completed: 18,
        firstTryCorrect: 9,
      },
      {
        ...base,
        lessonId: 'bad',
        started: 20,
        completed: 8,
        firstTryCorrect: 5,
      },
      {
        ...base,
        lessonId: 'tiny',
        started: 3,
        completed: 0,
        firstTryCorrect: 0,
      },
      {
        ...base,
        lessonId: 'meh',
        started: 10,
        completed: 4,
        firstTryCorrect: 8,
      },
    ]);

    // "bad" e "meh" empatam na conclusão (40%); o acerto desempata.
    expect(worst.map((lesson) => lesson.lessonId)).toEqual([
      'bad',
      'meh',
      'good',
    ]);
    expect(worst[0]?.completionRate).toBe(0.4);
  });

  it('converte receita e custo', () => {
    expect(
      monthlyRevenueCents({ priceCents: 4990, billingPeriod: 'MONTHLY' }),
    ).toBe(4990);
    expect(
      monthlyRevenueCents({ priceCents: 47_880, billingPeriod: 'YEARLY' }),
    ).toBe(3990);
    expect(usdMicrosToBrlCents(2_000_000, 5.5)).toBe(1100);
  });
});

describe('progress / trends', () => {
  it('repete a última foto nas semanas sem mudança', () => {
    const series = weeklyLevelSeries(
      [
        {
          weekStart: '2026-09-07',
          overallLevel: 'A1',
          levels: { GRAMMAR: { level: 'A1' } },
        },
        {
          weekStart: '2026-09-21',
          overallLevel: 'A2',
          levels: { GRAMMAR: { level: 'A2' } },
        },
      ],
      ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'],
    );

    expect(series.map((week) => week.overallLevel)).toEqual([
      null,
      'A1',
      'A1',
      'A2',
    ]);
    expect(series[2]?.levels).toEqual({ GRAMMAR: 'A1' });
  });

  it('diz se o erro está diminuindo pela taxa, não pela contagem', () => {
    expect(errorTrend([true, true, true, false, false, false])).toBe(
      'DECREASING',
    );
    expect(errorTrend([false, false, false, true, true, false])).toBe(
      'INCREASING',
    );
    expect(
      errorTrend([true, false, true, false, true, false, true, false]),
    ).toBe('STABLE');
    expect(errorTrend([true, false, false])).toBe('NOT_ENOUGH_DATA');
  });

  it('compara planejado e realizado por semana', () => {
    const weeks = weeklyCompliance(
      [
        { date: '2026-09-28', plannedMinutes: 30, studySeconds: 1800 },
        { date: '2026-09-29', plannedMinutes: 30, studySeconds: 0 },
        { date: '2026-10-05', plannedMinutes: 0, studySeconds: 600 },
      ],
      ['2026-09-28', '2026-10-05'],
      weekStart,
    );

    expect(weeks).toEqual([
      {
        weekStart: '2026-09-28',
        plannedMinutes: 60,
        studiedMinutes: 30,
        ratio: 0.5,
      },
      {
        weekStart: '2026-10-05',
        plannedMinutes: 0,
        studiedMinutes: 10,
        ratio: null,
      },
    ]);
  });
});

describe('progress / forecast', () => {
  const base = {
    today: '2026-09-28',
    planArrival: '2026-12-21', // 12 semanas
    plannedWeeklyMinutes: 120,
  };

  it('estudando metade do planejado, leva o dobro', () => {
    const forecast = paceForecast({
      ...base,
      recentWeeklyMinutes: [60, 60, 60],
    });

    expect(forecast.status).toBe('BEHIND');
    expect(forecast.byPace).toBe(addDays('2026-09-28', 168));
    expect(forecast.weeksDifference).toBe(12);
    expect(forecast.message).toContain('12 semanas depois');
  });

  it('estudando mais, chega antes', () => {
    const forecast = paceForecast({ ...base, recentWeeklyMinutes: [240, 240] });

    expect(forecast.status).toBe('AHEAD');
    expect(forecast.weeksDifference).toBe(-6);
  });

  it('no ritmo, com pequena diferença', () => {
    expect(
      paceForecast({ ...base, recentWeeklyMinutes: [118, 122] }).status,
    ).toBe('ON_TRACK');
  });

  it('sem dados suficientes, sem estudo ou sem plano', () => {
    expect(paceForecast({ ...base, recentWeeklyMinutes: [100] }).status).toBe(
      'TOO_EARLY',
    );
    expect(paceForecast({ ...base, recentWeeklyMinutes: [0, 0] }).status).toBe(
      'NO_STUDY',
    );
    expect(
      paceForecast({
        ...base,
        planArrival: null,
        recentWeeklyMinutes: [60, 60],
      }).status,
    ).toBe('NO_PLAN');
  });
});

describe('progress / actions', () => {
  const weakness = {
    skillId: 'grammar.past-simple.regular',
    title: 'Past simple',
  };
  const lesson = {
    lessonId: 'l1',
    slug: 'yesterday',
    title: 'Yesterday',
    completed: false,
  };

  it('prioriza a lição, depois a revisão, depois o material', () => {
    // A lição leva o slug — é o que a rota `/licoes/:slug` do front recebe.
    expect(
      suggestAction(weakness, {
        lesson,
        reviewCardId: 'c1',
        canGenerate: true,
      }),
    ).toMatchObject({
      type: 'LESSON',
      refId: 'l1',
      lessonSlug: 'yesterday',
    });
    expect(
      suggestAction(weakness, {
        lesson: { ...lesson, completed: true },
        reviewCardId: 'c1',
        canGenerate: true,
      }),
    ).toMatchObject({ type: 'REVIEW', refId: 'c1', lessonSlug: null });
    expect(
      suggestAction(weakness, {
        lesson: { ...lesson, completed: true },
        reviewCardId: null,
        canGenerate: true,
      }),
    ).toMatchObject({ type: 'MATERIAL', refId: weakness.skillId });
  });

  it('sem Plus, refaz a lição; sem lição, cai na prática', () => {
    expect(
      suggestAction(weakness, {
        lesson: { ...lesson, completed: true },
        reviewCardId: null,
        canGenerate: false,
      }),
    ).toMatchObject({
      type: 'LESSON',
      label: 'Refaça a lição "Yesterday"',
      lessonSlug: 'yesterday',
    });
    expect(
      suggestAction(weakness, {
        lesson: null,
        reviewCardId: null,
        canGenerate: false,
      }).type,
    ).toBe('PRACTICE');
  });

  it('acha a primeira lição do curso que ensina a skill', () => {
    const map = lessonBySkill([
      { lessonId: 'l1', slug: 'a', title: 'A', targetSkillIds: ['s1'] },
      { lessonId: 'l2', slug: 'b', title: 'B', targetSkillIds: ['s1', 's2'] },
    ]);

    expect(map.get('s1')).toMatchObject({ lessonId: 'l1', slug: 'a' });
    expect(map.get('s2')?.lessonId).toBe('l2');
    expect(accuracyLabel(4, 3)).toBe('75% de acerto de primeira (3 de 4)');
  });
});
