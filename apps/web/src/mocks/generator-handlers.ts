import { HttpResponse, http } from 'msw';

/**
 * Generator (módulo 13) no MSW. O job fica pronto na primeira leitura depois
 * do POST — o polling do app tem backoff (2 s, 4 s...), e esperar etapa por
 * etapa deixaria o teste lento. O estado "em andamento" tem ids próprios
 * (`job-running`, `job-failed`) que nunca mudam.
 */
const API_URL = 'http://localhost:3333';

export const plusCreditsFixture = {
  tier: 'PLUS',
  balance: 480,
  monthlyAiCredits: 500,
  costs: {
    TUTOR_CORRECTION: 1,
    TUTOR_ROLEPLAY: 3,
    GENERATOR_TOPIC: 5,
    GENERATOR_INGEST: 5,
  },
  nextGrantAt: '2026-10-01T00:05:00.000Z',
};

type StepState = { step: string; status: string };

const LABELS: Record<string, string> = {
  SUGGEST: 'Pensando em assuntos para você',
  INGEST_SOURCE: 'Lendo o conteúdo que você mandou',
  ANALYZE: 'Entendendo o texto',
  FETCH_SOURCE: 'Buscando a fonte',
  PICK_TARGETS: 'Escolhendo o que você vai praticar',
  GENERATE: 'Escrevendo o texto no seu nível',
  VALIDATE: 'Conferindo fatos e nível',
  EXERCISES: 'Montando os exercícios',
  DELIVER: 'Finalizando',
};

const TOPIC_STEPS = [
  'FETCH_SOURCE',
  'PICK_TARGETS',
  'GENERATE',
  'VALIDATE',
  'EXERCISES',
  'DELIVER',
];
const INGEST_STEPS = [
  'INGEST_SOURCE',
  'ANALYZE',
  'PICK_TARGETS',
  'GENERATE',
  'VALIDATE',
  'EXERCISES',
  'DELIVER',
];

export const suggestionsFixture = [
  {
    id: 'sug-1',
    title: "Magellan's voyage around the world",
    whyInteresting:
      'A primeira volta ao mundo de navio — e quase ninguém voltou para contar.',
    category: 'HISTORY',
  },
  {
    id: 'sug-2',
    title: 'The Treaty of Tordesillas',
    whyInteresting:
      'Portugal e Espanha dividiram o mundo com uma linha no mapa.',
    category: 'HISTORY',
  },
  {
    id: 'sug-3',
    title: 'Caravel',
    whyInteresting:
      'O navio pequeno que tornou as grandes navegações possíveis.',
    category: 'HISTORY',
  },
];

function jobView(input: {
  id: string;
  kind: 'SUGGEST' | 'TOPIC' | 'INGEST';
  status: string;
  steps: StepState[];
  message: string;
  materialId?: string | null;
  errorCode?: string | null;
}) {
  return {
    id: input.id,
    kind: input.kind,
    status: input.status,
    message: input.message,
    steps: input.steps.map((state) => ({
      ...state,
      label: LABELS[state.step] ?? state.step,
      startedAt: null,
      finishedAt: null,
    })),
    themes: input.kind === 'SUGGEST' ? ['história'] : [],
    suggestions:
      input.kind === 'SUGGEST' && input.status === 'DONE'
        ? suggestionsFixture
        : [],
    materialId: input.materialId ?? null,
    errorCode: input.errorCode ?? null,
    createdAt: '2026-09-29T12:00:00.000Z',
    completedAt: input.status === 'DONE' ? '2026-09-29T12:01:00.000Z' : null,
  };
}

function steps(list: string[], status: string): StepState[] {
  return list.map((step) => ({ step, status }));
}

type MockJob = { kind: 'SUGGEST' | 'TOPIC' | 'INGEST' };

let jobs = new Map<string, MockJob>();
let jobCounter = 0;
let materialFeedback: { rating: number | null; difficulty: string | null } = {
  rating: null,
  difficulty: null,
};
let termsInReview = new Set<string>(['caravel']);

/** Chame no `beforeEach` dos testes das ferramentas do Plus. */
export function resetGeneratorMockState(): void {
  jobs = new Map();
  jobCounter = 0;
  materialFeedback = { rating: null, difficulty: null };
  termsInReview = new Set(['caravel']);
}

function createJob(kind: MockJob['kind']) {
  jobCounter += 1;
  const id = `job-${kind.toLowerCase()}-${String(jobCounter)}`;
  jobs.set(id, { kind });

  const list =
    kind === 'SUGGEST'
      ? ['SUGGEST']
      : kind === 'TOPIC'
        ? TOPIC_STEPS
        : INGEST_STEPS;
  return jobView({
    id,
    kind,
    status: 'QUEUED',
    steps: steps(list, 'PENDING'),
    message: 'Seu pedido está na fila. Já, já começa.',
  });
}

export const materialFixture = {
  id: 'mat-1',
  kind: 'TOPIC',
  title: "Magellan's voyage",
  level: 'A2',
  topic: 'história',
  targetSkills: [
    { id: 'grammar.past-simple.irregular', title: 'Passado simples' },
  ],
  content: {
    title: "Magellan's voyage",
    level: 'A2',
    text: 'In 1519, Magellan left Spain with five ships. The caravel was small, but it was fast.',
    spans: [
      {
        start: 9,
        end: 28,
        kind: 'GRAMMAR',
        skillId: 'grammar.past-simple.irregular',
        explanationPtBr: 'Passado irregular: leave → left.',
      },
    ],
    grammarSpotlight: [
      {
        skillId: 'grammar.past-simple.irregular',
        structure: 'Past simple (irregular)',
        examplesFromText: ['Magellan left Spain'],
        explanationPtBr: 'Fato terminado no passado, com verbo irregular.',
      },
    ],
    spokenVersion: {
      setup: 'Dois amigos falando da viagem.',
      lines: [
        {
          speaker: 'Ana',
          spoken: 'You gonna read about Magellan?',
          standard: 'Are you going to read about Magellan?',
        },
        { speaker: 'Leo', spoken: 'Yes, I love history.', standard: null },
      ],
    },
    registerNotes: [],
    vocabulary: [
      {
        term: 'caravel',
        meaningPtBr: 'caravela',
        example: 'The caravel was small.',
        cefr: 'B1',
      },
      {
        term: 'set sail',
        meaningPtBr: 'zarpar',
        example: 'They set sail in 1519.',
        cefr: 'B1',
      },
    ],
  },
  attribution: {
    provider: 'Wikipedia',
    title: 'Ferdinand Magellan',
    url: 'https://en.wikipedia.org/wiki/Ferdinand_Magellan',
    revisionId: '123',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  referenceUrl: null,
  exercises: [
    {
      id: 'ex-1',
      type: 'MULTIPLE_CHOICE',
      prompt: 'In 1519, Magellan ___ Spain.',
      content: {
        options: [
          { id: 'left', text: 'left' },
          { id: 'leaved', text: 'leaved' },
        ],
        shuffle: false,
      },
      cefrLevel: 'A2',
      skillIds: ['grammar.past-simple.irregular'],
      assets: {},
      answer: null,
    },
  ],
  createdAt: '2026-09-29T12:01:00.000Z',
};

function materialView(id: string) {
  const base =
    id === 'mat-2'
      ? {
          ...materialFixture,
          id: 'mat-2',
          kind: 'INGEST',
          title: 'Whales are back',
          topic: 'natureza',
          attribution: null,
        }
      : materialFixture;

  return {
    ...base,
    content: {
      ...base.content,
      vocabulary: base.content.vocabulary.map((entry) => ({
        ...entry,
        termKey: entry.term.toLowerCase(),
        inReview: termsInReview.has(entry.term.toLowerCase()),
      })),
    },
    feedback: materialFeedback,
  };
}

export const materialsListFixture = [
  {
    id: 'mat-1',
    kind: 'TOPIC',
    title: "Magellan's voyage",
    level: 'B1',
    topic: 'história',
    targetSkills: [],
    exerciseCount: 6,
    rating: null,
    difficulty: null,
    createdAt: '2026-09-20T12:00:00.000Z',
  },
  {
    id: 'mat-0',
    kind: 'INGEST',
    title: 'Whales are back',
    level: 'A2',
    topic: 'natureza',
    targetSkills: [],
    exerciseCount: 5,
    rating: 5,
    difficulty: 'OK',
    createdAt: '2026-07-01T12:00:00.000Z',
  },
];

export const generatorHandlers = [
  http.get(`${API_URL}/me/interests`, () =>
    HttpResponse.json([
      { topic: 'history', weight: 80 },
      { topic: 'music', weight: 50 },
    ]),
  ),

  http.post(`${API_URL}/generator/topic/suggest`, () =>
    HttpResponse.json(createJob('SUGGEST'), { status: 202 }),
  ),
  http.post(`${API_URL}/generator/topic`, () =>
    HttpResponse.json(createJob('TOPIC'), { status: 202 }),
  ),
  http.post(`${API_URL}/generator/ingest`, () =>
    HttpResponse.json(createJob('INGEST'), { status: 202 }),
  ),

  http.get(`${API_URL}/generator/jobs/:id`, ({ params }) => {
    const id = String(params['id']);

    if (id === 'job-running') {
      return HttpResponse.json(
        jobView({
          id,
          kind: 'TOPIC',
          status: 'RUNNING',
          steps: [
            { step: 'FETCH_SOURCE', status: 'DONE' },
            { step: 'PICK_TARGETS', status: 'DONE' },
            { step: 'GENERATE', status: 'RUNNING' },
            { step: 'VALIDATE', status: 'PENDING' },
            { step: 'EXERCISES', status: 'PENDING' },
            { step: 'DELIVER', status: 'PENDING' },
          ],
          message: 'Escrevendo o texto no seu nível…',
        }),
      );
    }

    if (id === 'job-failed') {
      return HttpResponse.json(
        jobView({
          id,
          kind: 'TOPIC',
          status: 'FAILED',
          steps: [
            { step: 'FETCH_SOURCE', status: 'FAILED' },
            ...steps(TOPIC_STEPS.slice(1), 'PENDING'),
          ],
          message:
            'Não achamos uma fonte confiável sobre esse assunto. O crédito voltou — tenta outro tema.',
          errorCode: 'SOURCE_NOT_FOUND',
        }),
      );
    }

    const job = jobs.get(id);
    if (job === undefined) {
      return HttpResponse.json(
        {
          error: { code: 'NOT_FOUND', message: 'Não encontramos esse pedido.' },
        },
        { status: 404 },
      );
    }

    const list =
      job.kind === 'SUGGEST'
        ? ['SUGGEST']
        : job.kind === 'TOPIC'
          ? TOPIC_STEPS
          : INGEST_STEPS;

    return HttpResponse.json(
      jobView({
        id,
        kind: job.kind,
        status: 'DONE',
        steps: steps(list, 'DONE'),
        message:
          job.kind === 'SUGGEST'
            ? 'Escolhe um dos assuntos — ou pede para a gente escolher.'
            : 'Seu material está pronto.',
        materialId:
          job.kind === 'SUGGEST'
            ? null
            : job.kind === 'TOPIC'
              ? 'mat-1'
              : 'mat-2',
      }),
    );
  }),

  http.get(`${API_URL}/me/materials`, () =>
    HttpResponse.json({
      data: materialsListFixture,
      nextCursor: null,
      hasMore: false,
    }),
  ),

  http.get(`${API_URL}/me/materials/:id`, ({ params }) =>
    HttpResponse.json(materialView(String(params['id']))),
  ),

  http.post(`${API_URL}/me/materials/:id/answers`, async ({ request }) => {
    const body = (await request.json()) as {
      response: { optionIds?: string[] };
    };
    const isCorrect = body.response.optionIds?.[0] === 'left';

    return HttpResponse.json({
      answerId: 'answer-1',
      isCorrect,
      score: isCorrect ? 1 : 0,
      verdict: isCorrect ? 'CORRECT' : 'INCORRECT',
      feedback: isCorrect ? 'Isso mesmo.' : 'Quase.',
      explanation: 'O passado de "leave" é "left".',
      correctAnswer: { optionIds: ['left'], texts: ['left'] },
      errorPatterns: [],
      isFirstTry: true,
    });
  }),

  http.post(
    `${API_URL}/me/materials/:id/feedback`,
    async ({ params, request }) => {
      const body = (await request.json()) as {
        rating: number;
        difficulty?: string;
      };
      materialFeedback = {
        rating: body.rating,
        difficulty: body.difficulty ?? 'OK',
      };

      return HttpResponse.json({
        id: String(params['id']),
        ...materialFeedback,
      });
    },
  ),

  http.post(
    `${API_URL}/me/materials/:id/vocabulary/:termKey/review`,
    ({ params }) => {
      const termKey = decodeURIComponent(String(params['termKey']));
      termsInReview.add(termKey);
      return HttpResponse.json({ termKey, inReview: true });
    },
  ),

  http.delete(
    `${API_URL}/me/materials/:id/vocabulary/:termKey/review`,
    ({ params }) => {
      const termKey = decodeURIComponent(String(params['termKey']));
      termsInReview.delete(termKey);
      return HttpResponse.json({ termKey, inReview: false });
    },
  ),
];
