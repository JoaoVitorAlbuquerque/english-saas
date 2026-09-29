import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3333';

export const sessionFixture = {
  user: {
    id: 'user-1',
    name: 'Aluno Teste',
    email: 'aluno@exemplo.com',
    role: 'STUDENT',
    emailVerifiedAt: null,
  },
  accessToken: 'fake-access-token',
  csrfToken: 'fake-csrf-token',
};

export const freshProfileFixture = {
  userId: 'user-1',
  goals: [],
  goalNote: null,
  availabilityMinutes: {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  },
  preferredStudyTime: 'ANY',
  targetDate: null,
  selfReportedLevel: 'NONE',
  timezone: 'America/Sao_Paulo',
  nativeLanguage: 'pt-BR',
  onboardingCompletedAt: null,
};

export const completedProfileFixture = {
  ...freshProfileFixture,
  goals: ['TRAVEL'],
  availabilityMinutes: {
    mon: 20,
    tue: 20,
    wed: 20,
    thu: 20,
    fri: 20,
    sat: 0,
    sun: 0,
  },
  selfReportedLevel: 'NONE',
  onboardingCompletedAt: new Date().toISOString(),
};

export const placementFirstItemFixture = {
  id: 'item-1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Complete: I ___ Maya.',
  content: {
    options: [
      { id: 'am', text: 'am' },
      { id: 'is', text: 'is' },
      { id: 'are', text: 'are' },
    ],
    shuffle: false,
  },
  cefrLevel: 'A1',
  skillIds: ['grammar.be.present.affirmative'],
  assets: {},
};

export const placementInProgressFixture = {
  id: 'placement-1',
  status: 'IN_PROGRESS',
  answered: 0,
  maxItems: 30,
  next: placementFirstItemFixture,
  result: null,
};

export const placementResultFixture = {
  id: 'placement-1',
  status: 'COMPLETED',
  answered: 12,
  maxItems: 30,
  next: null,
  result: {
    overallLevel: 'B1',
    label: 'Intermediário',
    competencies: [
      { competency: 'GRAMMAR', label: 'Gramática', level: 'B1', items: 3 },
      {
        competency: 'VOCABULARY',
        label: 'Vocabulário',
        level: 'B1',
        items: 3,
      },
      { competency: 'READING', label: 'Leitura', level: 'A2', items: 3 },
      {
        competency: 'LISTENING',
        label: 'Compreensão oral',
        level: 'B1',
        items: 3,
      },
    ],
    masteredSkillIds: ['grammar.be.present.affirmative'],
    note: null,
    writingStatus: 'NOT_OFFERED',
    completedAt: new Date().toISOString(),
    // No passado: dá para refazer.
    nextAvailableAt: new Date(Date.now() - 1_000).toISOString(),
  },
};

// ---------------------------------------------------------------------------
// Lição "Nice to meet you" (F4) — fixtures compactas, mesma forma da real.
// ---------------------------------------------------------------------------

const CHAR_MAYA = 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';
const CHAR_LUCAS = 'b1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';

export const lessonFixture = {
  id: 'lesson-1',
  slug: 'nice-to-meet-you',
  order: 0,
  version: 1,
  title: 'Nice to meet you',
  objective: 'Se apresentar em inglês.',
  cefrLevel: 'A1',
  estimatedMinutes: 15,
  publishedAt: new Date().toISOString(),
  unit: {
    id: 'unit-1',
    slug: 'primeiros-passos',
    title: 'Primeiros passos',
    order: 0,
  },
  level: { cefrLevel: 'A1', title: 'Iniciante' },
  targetSkills: [
    {
      id: 'skill-intro',
      title: 'Se apresentar',
      type: 'FUNCTION',
      competency: 'GRAMMAR',
      cefrLevel: 'A1',
    },
  ],
  characters: [
    {
      id: CHAR_MAYA,
      slug: 'maya',
      name: 'Maya',
      bio: 'Vizinha do 4B.',
      avatarAssetId: null,
    },
    {
      id: CHAR_LUCAS,
      slug: 'lucas',
      name: 'Lucas',
      bio: 'Acabou de se mudar.',
      avatarAssetId: null,
    },
  ],
  registerNotes: [],
  items: [
    {
      id: 'd1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
      type: 'MULTIPLE_CHOICE',
      prompt: 'Complete: I ___ Lucas.',
      content: {
        options: [
          { id: 'am', text: 'am' },
          { id: 'is', text: 'is' },
          { id: 'are', text: 'are' },
        ],
        shuffle: false,
      },
      cefrLevel: 'A1',
      skillIds: ['skill-intro'],
    },
    {
      id: 'e1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
      type: 'TYPE_ANSWER',
      prompt: 'Escreva "Eu sou do Brasil" em inglês.',
      content: { hint: "I'm from ___" },
      cefrLevel: 'A1',
      skillIds: ['skill-intro'],
    },
  ],
  steps: [
    {
      order: 0,
      type: 'SCENE',
      content: {
        location: 'Corredor do prédio, em Austin',
        characterIds: [CHAR_MAYA, CHAR_LUCAS],
        lines: [
          {
            characterId: CHAR_MAYA,
            text: 'Hi! Are you new here?',
            translation: 'Oi! Você é novo aqui?',
            audioAssetId: 'c1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
            spans: [],
          },
          {
            characterId: CHAR_LUCAS,
            text: "Yes, I am. I'm Lucas.",
            standardText: 'Yes, I am. I am Lucas.',
            translation: 'Sou, sim. Eu sou o Lucas.',
            spans: [],
          },
        ],
      },
    },
    {
      order: 1,
      type: 'EXPLANATION_CARDS',
      content: {
        cards: [
          {
            title: "I'm = I am",
            bodyMd:
              'Na fala, quase sempre sai a forma curta: **I\'m**, não "I am".',
            examples: [],
          },
        ],
      },
    },
    {
      order: 2,
      type: 'PRACTICE',
      content: {
        itemIds: [
          'd1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
          'e1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
        ],
        shuffle: false,
      },
    },
    {
      order: 3,
      type: 'FREE_PRODUCTION',
      content: {
        prompt: 'Se apresente: diga seu nome e de onde você é.',
        helpers: ["I'm ___.", "I'm from ___."],
        rubric: [{ id: 'says-name', description: 'Diz o nome.' }],
        targetSkillIds: [],
      },
    },
    {
      order: 4,
      type: 'ROLEPLAY',
      content: {
        characterId: CHAR_MAYA,
        scenario: 'Você encontra a Maya no elevador do prédio.',
        openingLine: 'Hey! Going up?',
        goals: [
          { id: 'tell-name', description: 'Dizer o seu nome.', skillIds: [] },
        ],
        maxTurns: 4,
        allowedVocabularyLevel: 'A1',
      },
    },
    {
      order: 5,
      type: 'SUMMARY',
      content: {
        takeaways: ['O verbo to be muda com a pessoa: I am, you are, he is.'],
        skillIds: [],
        registerNoteIds: [],
      },
    },
  ],
  assets: {
    'c1b2c3d4-e5f6-4a1b-8c2d-1234567890ab': {
      id: 'c1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
      mimeType: 'audio/mpeg',
      durationMs: 1_500,
      url: 'https://example.com/scene-line-1.mp3',
    },
  },
};

type LessonMockState = {
  status: 'IN_PROGRESS' | 'COMPLETED';
  completedSteps: number[];
  answeredItemIds: string[];
  xpEarned: number;
};

const LESSON_MOCK_KEY = '__mock_lesson_state__';

function freshLessonMockState(): LessonMockState {
  return {
    status: 'IN_PROGRESS',
    completedSteps: [],
    answeredItemIds: [],
    xpEarned: 0,
  };
}

/**
 * Guardado em `localStorage`, não em variável de módulo: o Playwright roda o
 * player de verdade, e recarregar a página reexecuta este módulo do zero —
 * só o storage sobrevive, e é exatamente o que o teste de "retomar" precisa.
 */
function loadLessonMockState(): LessonMockState {
  try {
    const raw = window.localStorage.getItem(LESSON_MOCK_KEY);
    return raw === null
      ? freshLessonMockState()
      : (JSON.parse(raw) as LessonMockState);
  } catch {
    return freshLessonMockState();
  }
}

function saveLessonMockState(state: LessonMockState): void {
  try {
    window.localStorage.setItem(LESSON_MOCK_KEY, JSON.stringify(state));
  } catch {
    // Sem storage: a próxima leitura recomeça do zero.
  }
}

/** Chame no `beforeEach` de cada teste que usa a lição — a fila MSW não reseta sozinha. */
export function resetLessonMockState(): void {
  try {
    window.localStorage.removeItem(LESSON_MOCK_KEY);
  } catch {
    // nada a limpar
  }
  roleplayMockState = freshRoleplayMockState();
}

function currentStepIndexFor(state: LessonMockState): number {
  let index = 0;
  while (state.completedSteps.includes(index)) {
    index += 1;
  }
  return index;
}

function attemptViewFromState(state: LessonMockState) {
  return {
    id: 'attempt-1',
    lessonId: lessonFixture.id,
    lessonVersionId: 'version-1',
    version: 1,
    status: state.status,
    source: 'FREE_BROWSE',
    currentStepIndex: currentStepIndexFor(state),
    totalSteps: lessonFixture.steps.length,
    steps: lessonFixture.steps.map((step, index) => ({
      index,
      type: step.type,
      completed: state.completedSteps.includes(index),
      itemIds: step.type === 'PRACTICE' ? step.content.itemIds : [],
    })),
    answeredItemIds: state.answeredItemIds,
    xpEarned: state.xpEarned,
    startedAt: new Date().toISOString(),
    completedAt: state.status === 'COMPLETED' ? new Date().toISOString() : null,
  };
}

const ANSWER_RESULT_BY_ITEM: Record<string, Record<string, unknown>> = {
  'd1b2c3d4-e5f6-4a1b-8c2d-1234567890ab': {
    isCorrect: true,
    score: 1,
    verdict: 'CORRECT',
    feedback: 'Boa!',
    explanation: '"I am" concorda com "I".',
    correctAnswer: { optionIds: ['am'], texts: ['am'] },
    errorPatterns: [],
    isFirstTry: true,
  },
  'e1b2c3d4-e5f6-4a1b-8c2d-1234567890ab': {
    isCorrect: true,
    score: 1,
    verdict: 'CORRECT',
    feedback: 'Boa!',
    explanation: '"I\'m from ___" é o bloco certo aqui.',
    correctAnswer: { text: "I'm from Brazil." },
    errorPatterns: [],
    isFirstTry: true,
  },
  'f1b2c3d4-e5f6-4a1b-8c2d-1234567890ab': {
    isCorrect: true,
    score: 1,
    verdict: 'CORRECT',
    feedback: 'Boa!',
    explanation: '"is" concorda com "she".',
    correctAnswer: { optionIds: ['is'], texts: ['is'] },
    errorPatterns: [],
    isFirstTry: true,
  },
};

// ---------------------------------------------------------------------------
// Hoje (agenda) e Revisão — módulos 9 e 10.
// ---------------------------------------------------------------------------

const PRACTICE_ITEM_ID = 'f1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';
const REVIEW_SKILL_ITEM_ID = 'd1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';

export const statsFixture = {
  totalXp: 88,
  currentStreak: 3,
  longestStreak: 5,
  lastStudyDate: new Date().toISOString().slice(0, 10),
};

export const studyPlanFixture = {
  targetLevel: 'C1',
  targetDate: null as string | null,
  path: [
    {
      lessonId: lessonFixture.id,
      slug: lessonFixture.slug,
      unitId: lessonFixture.unit.id,
      title: lessonFixture.title,
      cefrLevel: 'A1',
      estimatedMinutes: lessonFixture.estimatedMinutes,
      order: 0,
      reason: 'Próxima da sua trilha.',
    },
  ],
  reinforceSkillIds: [] as string[],
  forecast: {
    estimatedArrival: '2027-06-01',
    weeksNeeded: 36,
    realistic: true,
    message: null as string | null,
  },
  version: 1,
};

export const forecastStatusFixture = {
  forecast: studyPlanFixture.forecast,
  weeksBehind: 0,
  message: null as string | null,
};

type AgendaBlockOverride = {
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  skipReason?: string;
  skipNote?: string;
  minutesSpent?: number;
};

let todayMockBlocks: Record<string, AgendaBlockOverride> = {};

function baseAgendaBlocks() {
  return [
    {
      id: 'review',
      type: 'REVIEW' as const,
      refId: 'review',
      estimatedMinutes: 5,
      reason: '3 cards de revisão vencidos.',
      count: 3,
    },
    {
      id: `lesson:${lessonFixture.id}`,
      type: 'LESSON' as const,
      refId: lessonFixture.id,
      slug: lessonFixture.slug,
      title: lessonFixture.title,
      estimatedMinutes: lessonFixture.estimatedMinutes,
      reason: 'Próxima da sua trilha.',
    },
    {
      id: `practice:${PRACTICE_ITEM_ID}`,
      type: 'PRACTICE' as const,
      refId: PRACTICE_ITEM_ID,
      estimatedMinutes: 1.5,
      reason: 'Ainda vale praticar "Presente do verbo to be".',
      item: {
        id: PRACTICE_ITEM_ID,
        type: 'MULTIPLE_CHOICE',
        prompt: 'Complete: She ___ from Brazil.',
        content: {
          options: [
            { id: 'is', text: 'is' },
            { id: 'am', text: 'am' },
            { id: 'are', text: 'are' },
          ],
          shuffle: false,
        },
        cefrLevel: 'A1',
        skillIds: ['skill-intro'],
        assets: {},
      },
    },
  ];
}

function agendaFixtureView() {
  const blocks = baseAgendaBlocks().map((block) => ({
    ...block,
    status: 'PENDING' as const,
    ...todayMockBlocks[block.id],
  }));

  return {
    localDate: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    blocks,
    minutesCompleted: blocks
      .filter((block) => block.status === 'COMPLETED')
      .reduce(
        (sum, block) => sum + (block.minutesSpent ?? block.estimatedMinutes),
        0,
      ),
  };
}

type ReviewMockState = { answeredCardIds: string[] };
let reviewMockState: ReviewMockState = { answeredCardIds: [] };

function reviewSessionCards() {
  const all = [
    {
      cardId: 'review-card-skill',
      kind: 'SKILL' as const,
      due: new Date().toISOString(),
      exercise: {
        type: 'ITEM' as const,
        item: {
          id: REVIEW_SKILL_ITEM_ID,
          type: 'MULTIPLE_CHOICE',
          prompt: 'Complete: I ___ Lucas.',
          content: {
            options: [
              { id: 'am', text: 'am' },
              { id: 'is', text: 'is' },
              { id: 'are', text: 'are' },
            ],
            shuffle: false,
          },
          cefrLevel: 'A1',
          skillIds: ['skill-intro'],
          assets: {},
        },
      },
    },
    {
      cardId: 'review-card-vocab',
      kind: 'VOCAB' as const,
      due: new Date().toISOString(),
      exercise: {
        type: 'FLASHCARD' as const,
        front: 'friendly',
        back: 'amigável',
      },
    },
  ];

  return all.filter(
    (card) => !reviewMockState.answeredCardIds.includes(card.cardId),
  );
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1_000).toISOString();
}

/** Chame no `beforeEach` dos testes de Hoje/Revisão. */
export function resetTodayMockState(): void {
  todayMockBlocks = {};
  reviewMockState = { answeredCardIds: [] };
}

// ---------------------------------------------------------------------------
// Roleplay da lição — estado próprio, mais simples que o da lição em si.
// ---------------------------------------------------------------------------

type RoleplayTurnMock = {
  index: number;
  role: 'STUDENT' | 'CHARACTER';
  text: string;
  status: 'DONE' | 'PENDING';
  feedback: Record<string, unknown> | null;
};

type RoleplayMockState = {
  status: 'ACTIVE' | 'FINISHED';
  turns: RoleplayTurnMock[];
  goalsMet: string[];
  summary: Record<string, unknown> | null;
};

function freshRoleplayMockState(): RoleplayMockState {
  return {
    status: 'ACTIVE',
    turns: [
      {
        index: 0,
        role: 'CHARACTER',
        text: 'Hey! Going up?',
        status: 'DONE',
        feedback: null,
      },
    ],
    goalsMet: [],
    summary: null,
  };
}

// Variável de módulo mesmo (não localStorage): o roleplay não precisa
// sobreviver a um reload de página nos testes — cada visita começa uma
// conversa nova, como a etapa realmente funciona.
let roleplayMockState = freshRoleplayMockState();

function roleplayViewFromState(state: RoleplayMockState) {
  return {
    id: 'roleplay-1',
    status: state.status,
    freeScenario: false,
    scenario: 'Você encontra a Maya no elevador do prédio.',
    character: { name: 'Maya', bio: 'Vizinha do 4B.' },
    goals: [
      {
        id: 'tell-name',
        description: 'Dizer o seu nome.',
        met: state.goalsMet.includes('tell-name'),
      },
    ],
    maxTurns: 4,
    turnsLeft:
      state.status === 'ACTIVE'
        ? 4 - state.turns.filter((t) => t.role === 'STUDENT').length
        : 0,
    turns: state.turns,
    summary: state.summary,
  };
}

/** A resposta do personagem "chega" quando o teste lê o estado de novo — sem timer de verdade. */
function resolvePendingRoleplayTurn(state: RoleplayMockState): void {
  const pending = state.turns.find((turn) => turn.status === 'PENDING');
  if (!pending) {
    return;
  }

  pending.status = 'DONE';
  pending.text = "That's great! Nice to meet you.";
  pending.feedback = {
    safety: 'OK',
    goalsMet: ['tell-name'],
    inlineCorrection: {
      original: 'I am Lucas',
      suggestion: 'My name is Lucas',
      explanationPtBr: 'Os dois jeitos funcionam — este soa mais natural aqui.',
      errorPatternId: null,
    },
    spokenVsStandard: null,
    helpPhrase: 'You can say: My name is ___.',
    expressionSkillIds: [],
  };
  state.goalsMet = [...new Set([...state.goalsMet, 'tell-name'])];
}

export const handlers = [
  http.post(`${API_URL}/auth/signin`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.password !== 'senha-correta') {
      return HttpResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'E-mail ou senha incorretos.',
          },
        },
        { status: 401 },
      );
    }

    return HttpResponse.json(sessionFixture);
  }),

  http.post(`${API_URL}/auth/signup`, () => HttpResponse.json(sessionFixture)),

  http.post(`${API_URL}/auth/refresh`, () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sessão expirada.' } },
      { status: 401 },
    ),
  ),

  http.post(
    `${API_URL}/auth/logout`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  http.get(`${API_URL}/me/profile`, () =>
    HttpResponse.json(freshProfileFixture),
  ),

  http.put(`${API_URL}/me/consents`, async ({ request }) => {
    const body = (await request.json()) as { type: string; granted: boolean };

    return HttpResponse.json([
      {
        type: body.type,
        version: '2026-01-01',
        granted: body.granted,
        grantedAt: body.granted ? new Date().toISOString() : null,
        revokedAt: body.granted ? null : new Date().toISOString(),
        upToDate: true,
      },
    ]);
  }),

  http.post(`${API_URL}/me/onboarding`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json({
      ...freshProfileFixture,
      ...body,
      onboardingCompletedAt: new Date().toISOString(),
      interests: body.interests ?? [],
    });
  }),

  http.get(`${API_URL}/placement/latest`, () =>
    HttpResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Você ainda não fez o teste de nível.',
        },
      },
      { status: 404 },
    ),
  ),

  http.post(`${API_URL}/placement/start`, () =>
    HttpResponse.json(placementInProgressFixture),
  ),

  http.post(`${API_URL}/placement/:id/answer`, () =>
    HttpResponse.json(placementResultFixture),
  ),

  http.get(`${API_URL}/me/plan`, () => HttpResponse.json(studyPlanFixture)),

  http.post(`${API_URL}/me/plan/rebuild`, () =>
    HttpResponse.json({
      ...studyPlanFixture,
      version: studyPlanFixture.version + 1,
    }),
  ),

  http.get(`${API_URL}/me/plan/forecast`, () =>
    HttpResponse.json(forecastStatusFixture),
  ),

  http.get(`${API_URL}/me/stats`, () => HttpResponse.json(statsFixture)),

  http.get(`${API_URL}/me/agenda`, () =>
    HttpResponse.json(agendaFixtureView()),
  ),

  http.post(
    `${API_URL}/me/agenda/blocks/:id/skip`,
    async ({ params, request }) => {
      const blockId = params.id as string;
      const body = (await request.json()) as { reason?: string; note?: string };
      const current = todayMockBlocks[blockId];

      if (current?.status !== 'COMPLETED') {
        todayMockBlocks[blockId] = {
          status: 'SKIPPED',
          skipReason: body.reason,
          skipNote: body.note,
        };
      }

      return HttpResponse.json(agendaFixtureView());
    },
  ),

  http.post(
    `${API_URL}/me/agenda/blocks/:id/complete`,
    async ({ params, request }) => {
      const blockId = params.id as string;
      const body = (await request.json()) as { minutesSpent?: number };
      const current = todayMockBlocks[blockId];

      if (current?.status !== 'COMPLETED') {
        const block = baseAgendaBlocks().find((entry) => entry.id === blockId);
        todayMockBlocks[blockId] = {
          status: 'COMPLETED',
          minutesSpent: body.minutesSpent ?? block?.estimatedMinutes,
        };
      }

      return HttpResponse.json(agendaFixtureView());
    },
  ),

  http.get(`${API_URL}/reviews/session`, () =>
    HttpResponse.json(reviewSessionCards()),
  ),

  http.post(
    `${API_URL}/reviews/:cardId/answer`,
    async ({ params, request }) => {
      const cardId = params.cardId as string;
      const body = (await request.json()) as {
        kind: 'ITEM' | 'SELF_RATING';
        selfRating?: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
      };

      if (!reviewMockState.answeredCardIds.includes(cardId)) {
        reviewMockState.answeredCardIds.push(cardId);
      }

      if (body.kind === 'ITEM') {
        return HttpResponse.json({
          cardId,
          rating: 'GOOD',
          nextDueAt: isoDaysFromNow(3),
          state: 'REVIEW',
          answer: {
            answerId: `answer-${cardId}`,
            isCorrect: true,
            score: 1,
            verdict: 'CORRECT',
            feedback: 'Boa!',
            explanation: '"I am" concorda com "I".',
            correctAnswer: { optionIds: ['am'], texts: ['am'] },
            errorPatterns: [],
            isFirstTry: true,
          },
        });
      }

      const daysByRating: Record<string, number> = {
        AGAIN: 0,
        HARD: 1,
        GOOD: 3,
        EASY: 7,
      };

      return HttpResponse.json({
        cardId,
        rating: body.selfRating,
        nextDueAt: isoDaysFromNow(daysByRating[body.selfRating ?? 'GOOD'] ?? 3),
        state: 'REVIEW',
      });
    },
  ),

  http.get(`${API_URL}/catalog/lessons/:slug`, ({ params }) => {
    if (params.slug === 'locked-lesson') {
      return HttpResponse.json(
        {
          error: {
            code: 'PLAN_REQUIRED',
            message:
              'Esse conteúdo faz parte dos planos pagos. Dá uma olhada nos planos para liberar.',
            details: { requiredPlan: 'BASE' },
          },
        },
        { status: 403 },
      );
    }

    return HttpResponse.json(lessonFixture);
  }),

  http.post(`${API_URL}/lessons/:id/attempts`, () => {
    const state = loadLessonMockState();
    return HttpResponse.json({
      ...attemptViewFromState(state),
      resumed: currentStepIndexFor(state) > 0,
    });
  }),

  http.post(`${API_URL}/attempts/:id/steps/:index/complete`, ({ params }) => {
    const state = loadLessonMockState();
    const index = Number(params.index);
    if (!state.completedSteps.includes(index)) {
      state.completedSteps.push(index);
    }
    saveLessonMockState(state);
    return HttpResponse.json(attemptViewFromState(state));
  }),

  http.post(`${API_URL}/attempts/:id/complete`, () => {
    const state = loadLessonMockState();
    state.status = 'COMPLETED';
    state.xpEarned = 30;
    saveLessonMockState(state);

    return HttpResponse.json({
      attempt: attemptViewFromState(state),
      xp: { fromAnswers: 10, completionBonus: 20, total: 30 },
      stats: {
        totalXp: 30,
        currentStreak: 1,
        longestStreak: 1,
        lastStudyDate: new Date().toISOString().slice(0, 10),
      },
    });
  }),

  http.post(`${API_URL}/answers`, async ({ request }) => {
    const body = (await request.json()) as { itemId: string };
    const state = loadLessonMockState();
    if (!state.answeredItemIds.includes(body.itemId)) {
      state.answeredItemIds.push(body.itemId);
    }
    saveLessonMockState(state);

    return HttpResponse.json({
      answerId: `answer-${body.itemId}`,
      ...(ANSWER_RESULT_BY_ITEM[body.itemId] ??
        ANSWER_RESULT_BY_ITEM['d1b2c3d4-e5f6-4a1b-8c2d-1234567890ab']),
    });
  }),

  http.post(`${API_URL}/tutor/corrections`, async ({ request }) => {
    const body = (await request.json()) as { text: string };

    // Marca de teste: o e2e escreve isto para simular saldo zerado.
    if (body.text.includes('[sem-credito]')) {
      return HttpResponse.json(
        {
          error: {
            code: 'INSUFFICIENT_AI_CREDITS',
            message:
              'Seus créditos de IA deste mês acabaram. Eles voltam no próximo ciclo.',
          },
        },
        { status: 402 },
      );
    }

    return HttpResponse.json({
      id: 'correction-1',
      status: 'QUEUED',
      message: 'Estamos corrigindo o seu texto. Leva alguns segundos.',
      lessonId: lessonFixture.id,
      stepIndex: 3,
      source: 'TEXT',
      text: body.text,
      result: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
  }),

  http.get(`${API_URL}/tutor/corrections/:id`, () =>
    HttpResponse.json({
      id: 'correction-1',
      status: 'DONE',
      message: 'Correção pronta.',
      lessonId: lessonFixture.id,
      stepIndex: 3,
      source: 'TEXT',
      text: "I'm Lucas.",
      result: {
        safety: 'OK',
        corrected: "I'm Lucas. I'm from Brazil.",
        fixes: [],
        rubric: [
          { goalId: 'says-name', met: true, comment: 'Disse o nome certinho.' },
        ],
        registerTips: [],
        encouragement: 'Mandou bem!',
        estimatedLevel: 'A1',
      },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }),
  ),

  http.post(`${API_URL}/tutor/roleplays`, () => {
    roleplayMockState = freshRoleplayMockState();
    return HttpResponse.json(roleplayViewFromState(roleplayMockState));
  }),

  http.get(`${API_URL}/tutor/roleplays/:id`, () => {
    resolvePendingRoleplayTurn(roleplayMockState);
    return HttpResponse.json(roleplayViewFromState(roleplayMockState));
  }),

  http.post(`${API_URL}/tutor/roleplays/:id/turns`, async ({ request }) => {
    const body = (await request.json()) as { text: string };
    const nextIndex = roleplayMockState.turns.length;

    roleplayMockState.turns.push(
      {
        index: nextIndex,
        role: 'STUDENT',
        text: body.text,
        status: 'DONE',
        feedback: null,
      },
      {
        index: nextIndex + 1,
        role: 'CHARACTER',
        text: '',
        status: 'PENDING',
        feedback: null,
      },
    );

    return HttpResponse.json(roleplayViewFromState(roleplayMockState));
  }),

  http.post(`${API_URL}/tutor/roleplays/:id/finish`, () => {
    resolvePendingRoleplayTurn(roleplayMockState);
    roleplayMockState.status = 'FINISHED';
    roleplayMockState.summary = {
      goals: [
        {
          id: 'tell-name',
          description: 'Dizer o seu nome.',
          met: roleplayMockState.goalsMet.includes('tell-name'),
        },
      ],
      topCorrections: roleplayMockState.turns
        .filter((turn) => turn.feedback?.inlineCorrection)
        .map(
          (turn) =>
            (turn.feedback as { inlineCorrection: unknown }).inlineCorrection,
        ),
      expressionSkillIds: [],
      finishedBy: 'STUDENT',
    };

    return HttpResponse.json(roleplayViewFromState(roleplayMockState));
  }),
];
