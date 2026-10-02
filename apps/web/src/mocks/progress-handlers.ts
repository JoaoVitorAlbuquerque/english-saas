import { HttpResponse, http } from 'msw';

/**
 * Progresso (módulos 7 e 14) no MSW. Dois alunos de exemplo: um com semanas de
 * estudo (`progressFixture`, com os quatro tipos de ação nos pontos fracos) e
 * um recém-chegado (`newStudentProgressFixture`).
 */
const API_URL = 'http://localhost:3333';

export const progressFixture = {
  period: { from: '2026-08-17', to: '2026-10-07', weeks: 8 },
  level: {
    overall: {
      level: 'A2',
      label: 'Básico',
      note: 'Calculado a partir das suas respostas.',
    },
    competencies: [
      {
        competency: 'GRAMMAR',
        label: 'Gramática',
        level: 'B1',
        confidence: 'Estimativa razoável',
        confidenceLevel: 'MEDIUM',
      },
      {
        competency: 'VOCABULARY',
        label: 'Vocabulário',
        level: 'B1',
        confidence: 'Estimativa firme',
        confidenceLevel: 'HIGH',
      },
      {
        competency: 'LISTENING',
        label: 'Escuta',
        level: 'A2',
        confidence: 'Ainda poucos dados',
        confidenceLevel: 'LOW',
      },
      {
        competency: 'READING',
        label: 'Leitura',
        level: 'A2',
        confidence: 'Estimativa razoável',
        confidenceLevel: 'MEDIUM',
      },
      {
        competency: 'WRITING',
        label: 'Escrita',
        level: 'A1',
        confidence: 'Ainda poucos dados',
        confidenceLevel: 'LOW',
      },
      {
        competency: 'SPEAKING',
        label: 'Fala',
        level: null,
        confidence: 'Ainda poucos dados',
        confidenceLevel: 'LOW',
      },
    ],
    weekly: [
      { weekStart: '2026-08-17', overallLevel: null, levels: {} },
      { weekStart: '2026-08-24', overallLevel: null, levels: {} },
      {
        weekStart: '2026-08-31',
        overallLevel: 'A1',
        levels: { GRAMMAR: 'A1' },
      },
      {
        weekStart: '2026-09-07',
        overallLevel: 'A1',
        levels: { GRAMMAR: 'A1' },
      },
      {
        weekStart: '2026-09-14',
        overallLevel: 'A2',
        levels: { GRAMMAR: 'A2' },
      },
      {
        weekStart: '2026-09-21',
        overallLevel: 'A2',
        levels: { GRAMMAR: 'A2' },
      },
      {
        weekStart: '2026-09-28',
        overallLevel: 'A2',
        levels: { GRAMMAR: 'B1' },
      },
      {
        weekStart: '2026-10-05',
        overallLevel: 'A2',
        levels: { GRAMMAR: 'B1' },
      },
    ],
  },
  strengths: [
    {
      skillId: 'function.introduce-yourself',
      title: 'Se apresentar',
      text: 'Você já domina: Se apresentar.',
    },
  ],
  weaknesses: [
    {
      skillId: 'grammar.past-simple',
      title: 'Passado simples',
      text: 'Vale reforçar: Passado simples. Você tem errado mais do que acertado nesse ponto.',
      action: {
        type: 'LESSON',
        refId: 'lesson-yesterday',
        lessonSlug: 'yesterday',
        label: 'Faça a lição "Yesterday"',
      },
    },
    {
      skillId: 'grammar.articles',
      title: 'Artigos',
      text: 'Vale reforçar: Artigos. Um erro tem aparecido com frequência aqui: I live in the Brazil',
      action: {
        type: 'REVIEW',
        refId: 'card-1',
        lessonSlug: null,
        label: 'Revise na sua sessão de revisão',
      },
    },
    {
      skillId: 'vocab.travel',
      title: 'Viagem',
      text: 'Vale reforçar: Viagem.',
      action: {
        type: 'MATERIAL',
        refId: 'vocab.travel',
        lessonSlug: null,
        label: 'Gere um material que trabalhe "Viagem"',
      },
    },
    {
      skillId: 'grammar.questions',
      title: 'Perguntas',
      text: 'Vale reforçar: Perguntas.',
      action: {
        type: 'PRACTICE',
        refId: null,
        lessonSlug: null,
        label: 'Pratique nos exercícios da sua agenda de hoje',
      },
    },
  ],
  stats: {
    minutesStudied: 340,
    lessonsCompleted: 6,
    reviewsDone: 48,
    currentStreak: 3,
    longestStreak: 9,
    accuracyByCompetency: [],
    topErrors: [
      {
        errorPatternId: 'l1.have-for-age',
        description: 'Dizer "I have 20 years" em vez de "I am 20 years old"',
        correction: 'I am 20 years old',
        recentOccurrences: 3,
        opportunities: 12,
        trend: 'DECREASING',
        trendLabel: 'Está diminuindo',
      },
      {
        errorPatternId: 'article.country-the',
        description: 'Usar "the" antes de nome de país',
        correction: 'I live in Brazil',
        recentOccurrences: 1,
        opportunities: 4,
        trend: 'NOT_ENOUGH_DATA',
        trendLabel: 'Ainda poucos dados',
      },
    ],
  },
  plan: {
    weeks: [
      {
        weekStart: '2026-08-17',
        plannedMinutes: 120,
        studiedMinutes: 0,
        ratio: 0,
      },
      {
        weekStart: '2026-08-24',
        plannedMinutes: 120,
        studiedMinutes: 30,
        ratio: 0.25,
      },
      {
        weekStart: '2026-08-31',
        plannedMinutes: 120,
        studiedMinutes: 60,
        ratio: 0.5,
      },
      {
        weekStart: '2026-09-07',
        plannedMinutes: 120,
        studiedMinutes: 45,
        ratio: 0.38,
      },
      {
        weekStart: '2026-09-14',
        plannedMinutes: 120,
        studiedMinutes: 90,
        ratio: 0.75,
      },
      {
        weekStart: '2026-09-21',
        plannedMinutes: 120,
        studiedMinutes: 135,
        ratio: 1.13,
      },
      {
        weekStart: '2026-09-28',
        plannedMinutes: 120,
        studiedMinutes: 100,
        ratio: 0.83,
      },
      {
        weekStart: '2026-10-05',
        plannedMinutes: 60,
        studiedMinutes: 30,
        ratio: 0.5,
      },
    ],
  },
  forecast: {
    byPlan: '2027-03-01',
    byPace: '2027-04-12',
    weeksDifference: 6,
    status: 'BEHIND',
    message:
      'No ritmo atual, você chega em 12/04/2027 — 6 semanas depois do previsto.',
    targetLevel: 'B1',
  },
};

export const newStudentProgressFixture = {
  period: { from: '2026-08-17', to: '2026-10-07', weeks: 8 },
  level: {
    overall: {
      level: 'A1',
      label: 'Iniciante',
      note: 'Ainda não temos dados seus. Começamos pelo A1 e ajustamos conforme você pratica.',
    },
    competencies: progressFixture.level.competencies.map((entry) => ({
      ...entry,
      level: null,
      confidence: 'Ainda poucos dados',
      confidenceLevel: 'LOW',
    })),
    weekly: progressFixture.level.weekly.map((week) => ({
      weekStart: week.weekStart,
      overallLevel: null,
      levels: {},
    })),
  },
  strengths: [],
  weaknesses: [],
  stats: {
    minutesStudied: 0,
    lessonsCompleted: 0,
    reviewsDone: 0,
    currentStreak: 0,
    longestStreak: 0,
    accuracyByCompetency: [],
    topErrors: [],
  },
  plan: {
    weeks: progressFixture.plan.weeks.map((week) => ({
      ...week,
      studiedMinutes: 0,
      ratio: 0,
    })),
  },
  forecast: {
    byPlan: null,
    byPace: null,
    weeksDifference: null,
    status: 'NO_PLAN',
    message:
      'Monte seu cronograma com os dias em que pode estudar para ver a previsão.',
    targetLevel: null,
  },
};

export const learnerProfileFixture = {
  errors: [
    {
      id: 'l1.have-for-age',
      description: 'Dizer "I have 20 years" em vez de "I am 20 years old"',
      correction: 'I am 20 years old',
      explanation: 'Em inglês, idade se diz com o verbo to be.',
      occurrences: 3,
      yourExamples: ['I have 22 years', 'She have 20 years'],
    },
  ],
  observedErrors: [
    {
      id: 'article.country-the',
      description: 'Usar "the" antes de nome de país',
      correction: 'I live in Brazil',
      explanation: 'Nome de país não leva artigo, com poucas exceções.',
      occurrences: 1,
      yourExamples: ['I live in the Brazil'],
    },
  ],
};

/** Quantas semanas cada chamada a `GET /me/progress` pediu, na ordem. */
export let progressRequestedWeeks: number[] = [];

/** Chame no `beforeEach` dos testes de progresso. */
export function resetProgressMockState(): void {
  progressRequestedWeeks = [];
}

export const progressHandlers = [
  http.get(`${API_URL}/me/progress`, ({ request }) => {
    const weeks = Number(new URL(request.url).searchParams.get('weeks') ?? 8);
    progressRequestedWeeks.push(weeks);

    return HttpResponse.json({
      ...progressFixture,
      period: { ...progressFixture.period, weeks },
    });
  }),

  http.get(`${API_URL}/me/learner-profile`, () =>
    HttpResponse.json(learnerProfileFixture),
  ),
];
