import {
  lessonVersionMetaPatchSchema,
  validateSteps,
  type ContentStatus,
} from '@english-saas/shared';
import { http, HttpResponse } from 'msw';

/**
 * API de conteúdo simulada, **com estado**: criar, reordenar, salvar e
 * transitar mudam o que as leituras seguintes devolvem, como o servidor de
 * verdade. Serve ao Vitest (`mocks/server.ts`) e ao build de e2e do
 * Playwright (`mocks/browser.ts`).
 *
 * Confere as mesmas regras que importam para a tela: slug repetido, ordem
 * completa no reordenar, versão aberta única, validação no envio para
 * revisão e edição de versão publicada. A validação do conteúdo usa as
 * funções reais do `packages/shared`.
 */

const API_URL = 'http://localhost:3333';
const BASE = `${API_URL}/admin/curriculum`;

export const MAYA_ID = '11111111-1111-4111-8111-111111111111';
export const LUCAS_ID = '22222222-2222-4222-8222-222222222222';
export const ITEM_AM_ID = '44444444-4444-4444-8444-444444444444';
export const ITEM_FILL_ID = '55555555-5555-4555-8555-555555555555';
export const ITEM_MATCH_ID = '66666666-6666-4666-8666-666666666666';
export const AUDIO_ID = '77777777-7777-4777-8777-777777777777';

type Json = Record<string, unknown>;

type MockStep = { id: string; order: number; type: string; content: unknown };

export type MockVersion = {
  id: string;
  lessonId: string;
  version: number;
  status: ContentStatus;
  title: string;
  objective: string;
  cefrLevel: string;
  estimatedMinutes: number;
  approvedAt: string | null;
  approvedById: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: MockStep[];
  targetSkillIds: string[];
};

export type MockLesson = {
  id: string;
  unitId: string;
  slug: string;
  order: number;
  publishedVersionId: string | null;
};

export type MockUnit = {
  id: string;
  levelId: string;
  slug: string;
  order: number;
  title: string;
  synopsis: string | null;
  status: ContentStatus;
};

export type MockCharacter = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  voiceId: string | null;
  avatarAssetId: string | null;
};

type MockAsset = {
  id: string;
  mimeType: string;
  storageKey: string;
  url: string;
};

type Failure = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

type MockState = {
  levels: { id: string; cefrLevel: string; title: string; order: number }[];
  units: MockUnit[];
  lessons: MockLesson[];
  versions: MockVersion[];
  characters: MockCharacter[];
  assets: MockAsset[];
  skills: Json[];
  registerNotes: Json[];
  errorPatterns: Json[];
  items: Json[];
  failures: Map<string, Failure[]>;
  calls: {
    reorderUnits: { levelId: string; ids: string[] }[];
    reorderLessons: { unitId: string; ids: string[] }[];
    metaSaves: { id: string; body: Json }[];
    stepSaves: { id: string; body: { steps: MockStep[] } }[];
    transitions: { id: string; action: string }[];
    unitTransitions: { id: string; action: string }[];
    uploads: { name: string; type: string; size: number }[];
    characterWrites: { id?: string; body: Json }[];
    previews: string[];
    skillQueries: string[];
    itemQueries: string[];
  };
  counter: number;
};

function iso(day: number): string {
  return new Date(Date.UTC(2026, 9, day, 12, 0, 0)).toISOString();
}

const SKILL_BE = 'grammar.be.present.affirmative';
const SKILL_CHUNK = 'chunk.nice-to-meet-you';
const SKILL_VOCAB = 'vocab.cafe';
const SKILL_GOING_TO = 'grammar.going-to-future';

function sceneContent(): Json {
  return {
    location: 'Corredor do prédio, em Austin',
    summary: 'Maya encontra o vizinho novo.',
    characterIds: [MAYA_ID, LUCAS_ID],
    lines: [
      {
        characterId: MAYA_ID,
        text: "Hi! I'm Maya. Are you new here?",
        translation: 'Oi! Eu sou a Maya. Você é novo aqui?',
        spans: [{ start: 4, end: 11, kind: 'GRAMMAR', skillId: SKILL_BE }],
      },
      {
        characterId: LUCAS_ID,
        text: "Yes, I'm gonna live in 4B.",
        standardText: "Yes, I'm going to live in 4B.",
        translation: 'Sim, eu vou morar no 4B.',
        spans: [],
      },
    ],
  };
}

function cardsContent(): Json {
  return {
    cards: [
      {
        title: 'Verbo to be',
        bodyMd: 'A forma muda com a **pessoa**.',
        examples: [
          { text: "I'm Maya.", translation: 'Eu sou a Maya.', spans: [] },
        ],
      },
    ],
  };
}

function practiceContent(): Json {
  return { itemIds: [ITEM_AM_ID, ITEM_FILL_ID], shuffle: false };
}

function freeProductionContent(): Json {
  return {
    prompt: 'Apresente-se em duas frases.',
    helpers: ["I'm from…", 'Nice to meet you'],
    rubric: [
      {
        id: 'nome',
        description: 'Diz o próprio nome.',
        skillId: SKILL_BE,
      },
    ],
    targetSkillIds: [SKILL_BE],
    minWords: 8,
  };
}

function roleplayContent(): Json {
  return {
    characterId: MAYA_ID,
    scenario: 'No elevador do prédio, você encontra a vizinha.',
    openingLine: 'Hi! Are you new here?',
    goals: [
      { id: 'nome', description: 'Dizer o próprio nome', skillIds: [SKILL_BE] },
    ],
    maxTurns: 6,
    allowedVocabularyLevel: 'A1',
  };
}

function summaryContent(): Json {
  return {
    takeaways: ["I am / I'm"],
    skillIds: [SKILL_BE],
    registerNoteIds: [],
  };
}

function fullSteps(prefix: string): MockStep[] {
  const content: [string, Json][] = [
    ['SCENE', sceneContent()],
    ['EXPLANATION_CARDS', cardsContent()],
    ['PRACTICE', practiceContent()],
    ['FREE_PRODUCTION', freeProductionContent()],
    ['ROLEPLAY', roleplayContent()],
    ['SUMMARY', summaryContent()],
  ];

  return content.map(([type, body], order) => ({
    id: `${prefix}-step-${String(order)}`,
    order,
    type,
    content: body,
  }));
}

function initialState(): MockState {
  return {
    levels: [
      { id: 'level-a1', cefrLevel: 'A1', title: 'Iniciante', order: 0 },
      { id: 'level-a2', cefrLevel: 'A2', title: 'Básico', order: 1 },
    ],
    units: [
      {
        id: 'unit-1',
        levelId: 'level-a1',
        slug: 'a1-u1-new-neighbors',
        order: 0,
        title: 'New neighbors',
        synopsis: 'Lucas conhece a nova vizinha.',
        status: 'PUBLISHED',
      },
      {
        id: 'unit-2',
        levelId: 'level-a1',
        slug: 'a1-u2-first-day',
        order: 1,
        title: 'First day',
        synopsis: null,
        status: 'DRAFT',
      },
    ],
    lessons: [
      {
        id: 'lesson-1',
        unitId: 'unit-1',
        slug: 'nice-to-meet-you',
        order: 0,
        publishedVersionId: 'version-1-2',
      },
      {
        id: 'lesson-2',
        unitId: 'unit-1',
        slug: 'at-the-cafe',
        order: 1,
        publishedVersionId: null,
      },
    ],
    versions: [
      {
        id: 'version-1-1',
        lessonId: 'lesson-1',
        version: 1,
        status: 'ARCHIVED',
        title: 'Nice to meet you',
        objective: 'Se apresentar.',
        cefrLevel: 'A1',
        estimatedMinutes: 10,
        approvedAt: iso(1),
        approvedById: 'user-1',
        publishedAt: iso(2),
        createdAt: iso(1),
        updatedAt: iso(3),
        steps: fullSteps('v11').slice(0, 3),
        targetSkillIds: [SKILL_BE],
      },
      {
        id: 'version-1-2',
        lessonId: 'lesson-1',
        version: 2,
        status: 'PUBLISHED',
        title: 'Nice to meet you',
        objective: 'Se apresentar e perguntar de onde a pessoa é.',
        cefrLevel: 'A1',
        estimatedMinutes: 12,
        approvedAt: iso(4),
        approvedById: 'user-1',
        publishedAt: iso(5),
        createdAt: iso(3),
        updatedAt: iso(5),
        steps: fullSteps('v12'),
        targetSkillIds: [SKILL_BE, SKILL_CHUNK],
      },
      {
        id: 'version-2-1',
        lessonId: 'lesson-2',
        version: 1,
        status: 'DRAFT',
        title: 'At the café',
        objective: 'Pedir um café e pagar.',
        cefrLevel: 'A1',
        estimatedMinutes: 10,
        approvedAt: null,
        approvedById: null,
        publishedAt: null,
        createdAt: iso(6),
        updatedAt: iso(6),
        steps: [
          {
            id: 'v21-step-0',
            order: 0,
            type: 'SCENE',
            content: sceneContent(),
          },
          {
            id: 'v21-step-1',
            order: 1,
            type: 'PRACTICE',
            content: practiceContent(),
          },
          {
            id: 'v21-step-2',
            order: 2,
            type: 'SUMMARY',
            content: summaryContent(),
          },
        ],
        targetSkillIds: [SKILL_VOCAB],
      },
    ],
    characters: [
      {
        id: MAYA_ID,
        slug: 'maya',
        name: 'Maya',
        bio: 'Vizinha de Lucas, fala rápido.',
        voiceId: 'voice-maya',
        avatarAssetId: null,
      },
      {
        id: LUCAS_ID,
        slug: 'lucas',
        name: 'Lucas',
        bio: null,
        voiceId: null,
        avatarAssetId: null,
      },
    ],
    assets: [],
    skills: [
      skill(SKILL_BE, 'GRAMMAR', 'GRAMMAR', 'A1', 'Verbo to be no presente'),
      skill(SKILL_CHUNK, 'CHUNK', 'SPEAKING', 'A1', 'Nice to meet you'),
      skill(SKILL_VOCAB, 'VOCAB_SET', 'VOCABULARY', 'A1', 'Pedir um café'),
      skill(SKILL_GOING_TO, 'GRAMMAR', 'GRAMMAR', 'A2', 'Futuro com going to'),
    ],
    registerNotes: [
      note('gonna', 'gonna', 'going to'),
      note('you-coming', 'You coming?', 'Are you coming?'),
    ],
    errorPatterns: [
      {
        id: 'l1.have-for-age',
        description: 'Usa "have" para dizer a idade.',
        example: 'I have 20 years.',
        correction: "I'm 20 years old.",
        explanation: 'Em inglês a idade usa o verbo to be.',
        skillIds: [SKILL_BE],
        deprecatedAt: null,
        replacedById: null,
      },
    ],
    items: [
      item(ITEM_AM_ID, 'MULTIPLE_CHOICE', 'I ___ Maya.', 'A1', {
        content: {
          options: [
            { id: 'am', text: 'am' },
            { id: 'is', text: 'is' },
          ],
          correctOptionIds: ['am'],
          shuffle: false,
        },
        explanation: 'Com "I", o verbo é "am".',
      }),
      item(ITEM_FILL_ID, 'FILL_BLANK', 'She ___ from Austin.', 'A1', {
        content: { sentence: 'She ___ from Austin.' },
        acceptedAnswers: ['is'],
        explanation: 'Com "she", o verbo é "is".',
      }),
      item(ITEM_MATCH_ID, 'MATCH', 'Ligue as palavras.', 'A2', {
        content: {
          pairs: [
            { left: 'cat', right: 'gato' },
            { left: 'dog', right: 'cachorro' },
          ],
        },
      }),
    ],
    failures: new Map(),
    calls: {
      reorderUnits: [],
      reorderLessons: [],
      metaSaves: [],
      stepSaves: [],
      transitions: [],
      unitTransitions: [],
      uploads: [],
      characterWrites: [],
      previews: [],
      skillQueries: [],
      itemQueries: [],
    },
    counter: 100,
  };
}

function skill(
  id: string,
  type: string,
  competency: string,
  cefrLevel: string,
  title: string,
): Json {
  return {
    id,
    type,
    competency,
    cefrLevel,
    title,
    description: null,
    prerequisites: [],
    commonErrors: [],
    goals: [],
    deprecatedAt: null,
    replacedById: null,
  };
}

function note(id: string, spokenForm: string, standardForm: string): Json {
  return {
    id,
    spokenForm,
    standardForm,
    register: 'INFORMAL_SPOKEN',
    explanation: 'Na fala do dia a dia.',
    whenToAvoid: null,
    cefrLevel: 'A1',
    skillId: null,
    deprecatedAt: null,
    replacedById: null,
  };
}

function item(
  id: string,
  type: string,
  prompt: string,
  cefrLevel: string,
  extra: { content: Json; acceptedAnswers?: unknown; explanation?: string },
): Json {
  return {
    id,
    slug: null,
    type,
    prompt,
    content: extra.content,
    acceptedAnswers: extra.acceptedAnswers ?? [],
    explanation: extra.explanation ?? null,
    errorPatternMap: {},
    cefrLevel,
    difficulty: -2,
    status: 'PUBLISHED',
    source: 'HUMAN',
    skillIds: [SKILL_BE],
  };
}

export let mockState: MockState = initialState();

/** Volta tudo ao que era no começo do teste. */
export function resetCurriculumMock(): void {
  mockState = initialState();
}

/** O próximo pedido a esta rota falha com a resposta dada (uma vez, por padrão). */
export function failNext(route: string, failure: Failure, times = 1): void {
  const list = mockState.failures.get(route) ?? [];

  mockState.failures.set(route, [
    ...list,
    ...Array.from({ length: times }, () => failure),
  ]);
}

function takeFailure(route: string): Response | null {
  const list = mockState.failures.get(route);
  const failure = list?.shift();

  if (failure === undefined) {
    return null;
  }

  return HttpResponse.json(
    {
      error: {
        code: failure.code,
        message: failure.message,
        ...(failure.details === undefined ? {} : { details: failure.details }),
      },
    },
    { status: failure.status },
  );
}

function error(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return HttpResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

/**
 * Lê o arquivo de um `multipart/form-data` direto dos bytes. `request.formData()`
 * trava no jsdom do Vitest (mistura de `File` do Node com o do jsdom), e esta
 * leitura serve igual no Vitest e no navegador do Playwright.
 */
async function readUploadedFile(
  request: Request,
): Promise<{ name: string; type: string; size: number } | null> {
  const bytes = new Uint8Array(await request.arrayBuffer());
  const text = new TextDecoder('latin1').decode(bytes);
  const header =
    /Content-Disposition: form-data; name="file"; filename="([^"]*)"\r\nContent-Type: ([^\r\n]*)\r\n\r\n/i.exec(
      text,
    );

  if (header === null) {
    return null;
  }

  const start = header.index + header[0].length;
  const end = text.indexOf('\r\n--', start);

  return {
    name: header[1] ?? '',
    type: header[2] ?? '',
    size: (end === -1 ? text.length : end) - start,
  };
}

function nextId(prefix: string): string {
  mockState.counter += 1;

  return `${prefix}-${String(mockState.counter)}`;
}

// ---------------------------------------------------------------------------
// Regras espelhadas do servidor
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<
  string,
  Partial<Record<ContentStatus, ContentStatus>>
> = {
  submit: { DRAFT: 'IN_REVIEW' },
  'submit-for-review': { DRAFT: 'IN_REVIEW' },
  approve: { IN_REVIEW: 'APPROVED' },
  reject: { IN_REVIEW: 'DRAFT', APPROVED: 'DRAFT' },
  publish: { APPROVED: 'PUBLISHED' },
  archive: {
    DRAFT: 'ARCHIVED',
    IN_REVIEW: 'ARCHIVED',
    APPROVED: 'ARCHIVED',
    PUBLISHED: 'ARCHIVED',
  },
};

function isEditable(status: ContentStatus): boolean {
  return status === 'DRAFT' || status === 'IN_REVIEW' || status === 'APPROVED';
}

function afterEdit(version: MockVersion): void {
  if (version.status === 'IN_REVIEW' || version.status === 'APPROVED') {
    version.status = 'DRAFT';
    version.approvedAt = null;
    version.approvedById = null;
  }

  version.updatedAt = new Date().toISOString();
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Formas de resposta
// ---------------------------------------------------------------------------

function unitView(unit: MockUnit): Json {
  return {
    id: unit.id,
    levelId: unit.levelId,
    slug: unit.slug,
    order: unit.order,
    title: unit.title,
    synopsis: unit.synopsis,
    status: unit.status,
    coverAssetId: null,
    cast: [],
    lessons: mockState.lessons
      .filter((lesson) => lesson.unitId === unit.id)
      .sort((a, b) => a.order - b.order)
      .map((lesson) => ({
        id: lesson.id,
        unitId: lesson.unitId,
        slug: lesson.slug,
        order: lesson.order,
        publishedVersionId: lesson.publishedVersionId,
      })),
  };
}

function sortedUnits(levelId?: string | null): MockUnit[] {
  const levelOrder = (id: string) =>
    mockState.levels.find((level) => level.id === id)?.order ?? 0;

  return mockState.units
    .filter((unit) => levelId == null || unit.levelId === levelId)
    .sort(
      (a, b) =>
        levelOrder(a.levelId) - levelOrder(b.levelId) || a.order - b.order,
    );
}

function versionView(version: MockVersion): Json {
  const lesson = mockState.lessons.find((l) => l.id === version.lessonId);

  return {
    id: version.id,
    version: version.version,
    status: version.status,
    title: version.title,
    objective: version.objective,
    cefrLevel: version.cefrLevel,
    estimatedMinutes: version.estimatedMinutes,
    approvedAt: version.approvedAt,
    approvedById: version.approvedById,
    publishedAt: version.publishedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    lesson: {
      id: lesson?.id ?? version.lessonId,
      slug: lesson?.slug ?? '',
      order: lesson?.order ?? 0,
      unitId: lesson?.unitId ?? '',
    },
    steps: [...version.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        id: step.id,
        order: step.order,
        type: step.type,
        content: step.content,
      })),
    targetSkills: version.targetSkillIds.map((skillId, position) => ({
      skillId,
      position,
    })),
  };
}

function lessonSummary(lesson: MockLesson): Json {
  return {
    id: lesson.id,
    slug: lesson.slug,
    order: lesson.order,
    unitId: lesson.unitId,
    publishedVersionId: lesson.publishedVersionId,
    versions: mockState.versions
      .filter((version) => version.lessonId === lesson.id)
      .sort((a, b) => b.version - a.version)
      .map((version) => ({
        id: version.id,
        version: version.version,
        status: version.status,
        title: version.title,
        publishedAt: version.publishedAt,
      })),
  };
}

function lessonFull(lesson: MockLesson): Json {
  return {
    id: lesson.id,
    slug: lesson.slug,
    order: lesson.order,
    unitId: lesson.unitId,
    publishedVersionId: lesson.publishedVersionId,
    versions: mockState.versions
      .filter((version) => version.lessonId === lesson.id)
      .sort((a, b) => b.version - a.version)
      .map(versionView),
  };
}

function sortedLessons(unitId?: string | null): MockLesson[] {
  const unitOrder = (id: string) =>
    mockState.units.find((unit) => unit.id === id)?.order ?? 0;

  return mockState.lessons
    .filter((lesson) => unitId == null || lesson.unitId === unitId)
    .sort(
      (a, b) => unitOrder(a.unitId) - unitOrder(b.unitId) || a.order - b.order,
    );
}

function characterView(character: MockCharacter): Json {
  const asset = mockState.assets.find((a) => a.id === character.avatarAssetId);

  return { ...character, avatarUrl: asset?.url ?? null };
}

function previewView(version: MockVersion): Json {
  const lesson = mockState.lessons.find((l) => l.id === version.lessonId);
  const unit = mockState.units.find((u) => u.id === lesson?.unitId);
  const level = mockState.levels.find((l) => l.id === unit?.levelId);
  const steps = [...version.steps].sort((a, b) => a.order - b.order);
  const itemIds = new Set<string>();
  const characterIds = new Set<string>();
  const assetIds = new Set<string>();

  for (const step of steps) {
    const content = (step.content ?? {}) as Json;

    if (Array.isArray(content.itemIds)) {
      content.itemIds.forEach((id) => itemIds.add(String(id)));
    }

    if (typeof content.characterId === 'string') {
      characterIds.add(content.characterId);
    }

    if (Array.isArray(content.characterIds)) {
      content.characterIds.forEach((id) => characterIds.add(String(id)));
    }

    if (typeof content.audioAssetId === 'string') {
      assetIds.add(content.audioAssetId);
    }
  }

  const assets: Record<string, Json> = {};

  for (const id of assetIds) {
    assets[id] = {
      id,
      mimeType: 'audio/mpeg',
      durationMs: 1000,
      url: `https://cdn.example.com/${id}.mp3`,
    };
  }

  return {
    id: lesson?.id ?? version.lessonId,
    slug: lesson?.slug ?? '',
    order: lesson?.order ?? 0,
    version: version.version,
    title: version.title,
    objective: version.objective,
    cefrLevel: version.cefrLevel,
    estimatedMinutes: version.estimatedMinutes,
    publishedAt: version.publishedAt,
    unit: {
      id: unit?.id ?? '',
      slug: unit?.slug ?? '',
      title: unit?.title ?? '',
      order: unit?.order ?? 0,
    },
    level: { cefrLevel: level?.cefrLevel ?? 'A1', title: level?.title ?? '' },
    targetSkills: version.targetSkillIds.flatMap((id) => {
      const found = mockState.skills.find((s) => s.id === id);

      return found === undefined
        ? []
        : [
            {
              id,
              title: found.title,
              type: found.type,
              competency: found.competency,
              cefrLevel: found.cefrLevel,
            },
          ];
    }),
    characters: mockState.characters
      .filter((character) => characterIds.has(character.id))
      .map((character) => ({
        id: character.id,
        slug: character.slug,
        name: character.name,
        bio: character.bio,
        avatarAssetId: character.avatarAssetId,
      })),
    registerNotes: [],
    // Sem gabarito: o aluno não vê `correctOptionIds` nem `acceptedAnswers`.
    items: mockState.items
      .filter((candidate) => itemIds.has(String(candidate.id)))
      .map((candidate) => {
        const { correctOptionIds: _key, ...content } =
          candidate.content as Json;

        return {
          id: candidate.id,
          type: candidate.type,
          prompt: candidate.prompt,
          content,
          cefrLevel: candidate.cefrLevel,
          skillIds: candidate.skillIds,
        };
      }),
    steps: steps.map((step) => ({
      order: step.order,
      type: step.type,
      content: step.content,
    })),
    assets,
  };
}

function issuesOf(version: MockVersion): unknown[] {
  const result = validateSteps(
    version.steps.map((step) => ({
      order: step.order,
      type: step.type as never,
      content: step.content,
    })),
  );

  return result.ok ? [] : result.issues;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function findVersion(id: string): MockVersion | undefined {
  return mockState.versions.find((version) => version.id === id);
}

function notFound(): Response {
  return error(404, 'NOT_FOUND', 'Não encontramos o que você procura.');
}

export const curriculumHandlers = [
  // --- Estrutura ---

  http.get(`${BASE}/courses`, () =>
    HttpResponse.json([
      {
        id: 'course-1',
        slug: 'english',
        title: 'Inglês',
        language: 'en',
        description: null,
        levels: mockState.levels.map((level) => ({
          id: level.id,
          courseId: 'course-1',
          cefrLevel: level.cefrLevel,
          title: level.title,
          description: null,
          objectives: [],
          order: level.order,
        })),
      },
    ]),
  ),

  http.get(`${BASE}/units`, ({ request }) => {
    const levelId = new URL(request.url).searchParams.get('levelId');

    return HttpResponse.json(sortedUnits(levelId).map(unitView));
  }),

  http.post(`${BASE}/units/reorder`, async ({ request }) => {
    const body = (await request.json()) as { levelId: string; ids: string[] };

    mockState.calls.reorderUnits.push(body);

    const failure = takeFailure('reorder-units');

    if (failure) {
      return failure;
    }

    const siblings = mockState.units.filter(
      (unit) => unit.levelId === body.levelId,
    );
    const known = new Set(siblings.map((unit) => unit.id));

    if (
      body.ids.length !== known.size ||
      !body.ids.every((id) => known.has(id))
    ) {
      return error(
        422,
        'REORDER_MISMATCH',
        'A lista de reordenação não bate com o que existe agora.',
      );
    }

    body.ids.forEach((id, order) => {
      const unit = mockState.units.find((candidate) => candidate.id === id);

      if (unit) {
        unit.order = order;
      }
    });

    return HttpResponse.json(sortedUnits().map(unitView), { status: 201 });
  }),

  http.post(`${BASE}/units`, async ({ request }) => {
    const body = (await request.json()) as Json;
    const failure = takeFailure('create-unit');

    if (failure) {
      return failure;
    }

    if (mockState.units.some((unit) => unit.slug === body.slug)) {
      return error(
        409,
        'SLUG_IN_USE',
        `Já existe conteúdo com o identificador "${String(body.slug)}".`,
      );
    }

    const unit: MockUnit = {
      id: nextId('unit'),
      levelId: String(body.levelId),
      slug: String(body.slug),
      order: Number(body.order),
      title: String(body.title),
      synopsis: typeof body.synopsis === 'string' ? body.synopsis : null,
      status: 'DRAFT',
    };

    mockState.units.push(unit);

    return HttpResponse.json(unitView(unit), { status: 201 });
  }),

  http.post(`${BASE}/units/:id/transition`, async ({ params, request }) => {
    const { action } = (await request.json()) as { action: string };
    const unit = mockState.units.find(
      (candidate) => candidate.id === params.id,
    );

    mockState.calls.unitTransitions.push({ id: String(params.id), action });

    if (unit === undefined) {
      return notFound();
    }

    const failure = takeFailure('unit-transition');

    if (failure) {
      return failure;
    }

    const target = TRANSITIONS[action]?.[unit.status];

    if (target === undefined) {
      return error(
        409,
        'INVALID_CONTENT_TRANSITION',
        'Não dá para fazer isso com a unidade neste estado.',
      );
    }

    unit.status = target;

    return HttpResponse.json(unitView(unit), { status: 201 });
  }),

  // --- Lição ---

  http.get(`${BASE}/lessons`, ({ request }) => {
    const unitId = new URL(request.url).searchParams.get('unitId');

    return HttpResponse.json(sortedLessons(unitId).map(lessonSummary));
  }),

  http.post(`${BASE}/lessons/reorder`, async ({ request }) => {
    const body = (await request.json()) as { unitId: string; ids: string[] };

    mockState.calls.reorderLessons.push(body);

    const failure = takeFailure('reorder-lessons');

    if (failure) {
      return failure;
    }

    const siblings = mockState.lessons.filter(
      (lesson) => lesson.unitId === body.unitId,
    );
    const known = new Set(siblings.map((lesson) => lesson.id));

    if (
      body.ids.length !== known.size ||
      !body.ids.every((id) => known.has(id))
    ) {
      return error(
        422,
        'REORDER_MISMATCH',
        'A lista de reordenação não bate com o que existe agora.',
      );
    }

    body.ids.forEach((id, order) => {
      const lesson = mockState.lessons.find((candidate) => candidate.id === id);

      if (lesson) {
        lesson.order = order;
      }
    });

    return HttpResponse.json(sortedLessons().map(lessonSummary), {
      status: 201,
    });
  }),

  http.get(`${BASE}/lessons/:id`, ({ params }) => {
    const lesson = mockState.lessons.find((l) => l.id === params.id);

    return lesson === undefined
      ? notFound()
      : HttpResponse.json(lessonFull(lesson));
  }),

  http.post(`${BASE}/lessons`, async ({ request }) => {
    const body = (await request.json()) as Json;
    const failure = takeFailure('create-lesson');

    if (failure) {
      return failure;
    }

    if (mockState.lessons.some((lesson) => lesson.slug === body.slug)) {
      return error(
        409,
        'SLUG_IN_USE',
        `Já existe conteúdo com o identificador "${String(body.slug)}".`,
      );
    }

    const lesson: MockLesson = {
      id: nextId('lesson'),
      unitId: String(body.unitId),
      slug: String(body.slug),
      order: Number(body.order),
      publishedVersionId: null,
    };
    const now = new Date().toISOString();

    mockState.lessons.push(lesson);
    mockState.versions.push({
      id: nextId('version'),
      lessonId: lesson.id,
      version: 1,
      status: 'DRAFT',
      title: String(body.title),
      objective: String(body.objective),
      cefrLevel: String(body.cefrLevel),
      estimatedMinutes:
        typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : 10,
      approvedAt: null,
      approvedById: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      steps: [],
      targetSkillIds: Array.isArray(body.targetSkillIds)
        ? body.targetSkillIds.map(String)
        : [],
    });

    return HttpResponse.json(lessonFull(lesson), { status: 201 });
  }),

  http.post(`${BASE}/lessons/:id/versions`, ({ params }) => {
    const lesson = mockState.lessons.find((l) => l.id === params.id);

    if (lesson === undefined) {
      return notFound();
    }

    const failure = takeFailure('create-version');

    if (failure) {
      return failure;
    }

    const versions = mockState.versions.filter((v) => v.lessonId === lesson.id);
    const open = versions.find((version) => isEditable(version.status));

    if (open !== undefined) {
      return error(
        409,
        'DRAFT_ALREADY_OPEN',
        `A versão ${String(open.version)} ainda está aberta. Publique ou arquive ela antes de começar outra.`,
        { version: open.version },
      );
    }

    const source =
      versions.find((version) => version.id === lesson.publishedVersionId) ??
      [...versions].sort((a, b) => b.version - a.version)[0];

    if (source === undefined) {
      return notFound();
    }

    const now = new Date().toISOString();
    const created: MockVersion = {
      ...structuredClone(source),
      id: nextId('version'),
      version: Math.max(...versions.map((v) => v.version)) + 1,
      status: 'DRAFT',
      approvedAt: null,
      approvedById: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      steps: source.steps.map((step) => ({
        ...structuredClone(step),
        id: nextId('step'),
      })),
    };

    mockState.versions.push(created);

    return HttpResponse.json(versionView(created), { status: 201 });
  }),

  // --- Versão ---

  http.get(`${BASE}/lesson-versions/:id/preview`, ({ params }) => {
    const version = findVersion(String(params.id));

    if (version === undefined) {
      return notFound();
    }

    mockState.calls.previews.push(version.id);

    return HttpResponse.json(previewView(version));
  }),

  http.get(`${BASE}/lesson-versions/:id`, ({ params }) => {
    const version = findVersion(String(params.id));

    return version === undefined
      ? notFound()
      : HttpResponse.json(versionView(version));
  }),

  http.put(`${BASE}/lesson-versions/:id/steps`, async ({ params, request }) => {
    const version = findVersion(String(params.id));
    const body = (await request.json()) as { steps: MockStep[] };

    if (version === undefined) {
      return notFound();
    }

    mockState.calls.stepSaves.push({ id: version.id, body });

    const failure = takeFailure('save-steps');

    if (failure) {
      return failure;
    }

    if (!isEditable(version.status)) {
      return error(
        409,
        'INVALID_CONTENT_TRANSITION',
        'Não dá para editar um conteúdo que está publicado.',
      );
    }

    version.steps = body.steps.map((step, order) => ({
      id: nextId('step'),
      order,
      type: step.type,
      content: step.content,
    }));
    afterEdit(version);

    return HttpResponse.json({
      ...versionView(version),
      issues: issuesOf(version),
    });
  }),

  http.put(`${BASE}/lesson-versions/:id`, async ({ params, request }) => {
    const version = findVersion(String(params.id));
    const body = (await request.json()) as Json;

    if (version === undefined) {
      return notFound();
    }

    mockState.calls.metaSaves.push({ id: version.id, body });

    const failure = takeFailure('save-meta');

    if (failure) {
      return failure;
    }

    const parsed = lessonVersionMetaPatchSchema.safeParse(body);

    if (!parsed.success) {
      return error(422, 'VALIDATION_ERROR', 'Os dados enviados são inválidos.');
    }

    if (!isEditable(version.status)) {
      return error(
        409,
        'INVALID_CONTENT_TRANSITION',
        'Não dá para editar um conteúdo que está publicado.',
      );
    }

    const patch = parsed.data;

    if (patch.title !== undefined) version.title = patch.title;
    if (patch.objective !== undefined) version.objective = patch.objective;
    if (patch.cefrLevel !== undefined) version.cefrLevel = patch.cefrLevel;
    if (patch.estimatedMinutes !== undefined) {
      version.estimatedMinutes = patch.estimatedMinutes;
    }
    if (patch.targetSkillIds !== undefined) {
      version.targetSkillIds = patch.targetSkillIds;
    }

    afterEdit(version);

    return HttpResponse.json(versionView(version));
  }),

  http.post(`${BASE}/lesson-versions/:id/:action`, ({ params }) => {
    const version = findVersion(String(params.id));
    const action = String(params.action);

    if (version === undefined) {
      return notFound();
    }

    mockState.calls.transitions.push({ id: version.id, action });

    const failure = takeFailure(`version-action:${action}`);

    if (failure) {
      return failure;
    }

    const target = TRANSITIONS[action]?.[version.status];

    if (target === undefined) {
      return error(
        409,
        'INVALID_CONTENT_TRANSITION',
        'Não dá para fazer isso com a versão neste estado.',
      );
    }

    if (action === 'submit-for-review') {
      const issues = issuesOf(version);

      if (issues.length > 0) {
        return error(
          422,
          'CONTENT_VALIDATION_FAILED',
          'O conteúdo tem problemas que precisam ser corrigidos antes de salvar.',
          { issues },
        );
      }
    }

    version.status = target;

    if (action === 'approve') {
      version.approvedAt = new Date().toISOString();
      version.approvedById = 'user-1';
    }

    if (action === 'reject') {
      version.approvedAt = null;
      version.approvedById = null;
    }

    if (action === 'publish') {
      const lesson = mockState.lessons.find((l) => l.id === version.lessonId);

      for (const other of mockState.versions) {
        if (
          other.lessonId === version.lessonId &&
          other.status === 'PUBLISHED' &&
          other.id !== version.id
        ) {
          other.status = 'ARCHIVED';
        }
      }

      version.publishedAt = new Date().toISOString();

      if (lesson) {
        lesson.publishedVersionId = version.id;
      }
    }

    return HttpResponse.json(versionView(version), { status: 201 });
  }),

  // --- Personagens e mídia ---

  http.get(`${BASE}/characters`, () =>
    HttpResponse.json(mockState.characters.map(characterView)),
  ),

  http.post(`${BASE}/characters`, async ({ request }) => {
    const body = (await request.json()) as Json;

    mockState.calls.characterWrites.push({ body });

    const failure = takeFailure('save-character');

    if (failure) {
      return failure;
    }

    if (mockState.characters.some((c) => c.slug === body.slug)) {
      return error(
        409,
        'SLUG_IN_USE',
        `Já existe conteúdo com o identificador "${String(body.slug)}".`,
      );
    }

    const character: MockCharacter = {
      id: nextId('char'),
      slug: String(body.slug),
      name: String(body.name),
      bio: typeof body.bio === 'string' ? body.bio : null,
      voiceId: typeof body.voiceId === 'string' ? body.voiceId : null,
      avatarAssetId:
        typeof body.avatarAssetId === 'string' ? body.avatarAssetId : null,
    };

    mockState.characters.push(character);

    return HttpResponse.json(characterView(character), { status: 201 });
  }),

  http.patch(`${BASE}/characters/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Json;
    const character = mockState.characters.find((c) => c.id === params.id);

    mockState.calls.characterWrites.push({ id: String(params.id), body });

    if (character === undefined) {
      return notFound();
    }

    const failure = takeFailure('save-character');

    if (failure) {
      return failure;
    }

    if (typeof body.name === 'string') character.name = body.name;
    if ('bio' in body) character.bio = (body.bio as string | null) ?? null;
    if ('voiceId' in body) {
      character.voiceId = (body.voiceId as string | null) ?? null;
    }
    if ('avatarAssetId' in body) {
      character.avatarAssetId = (body.avatarAssetId as string | null) ?? null;
    }

    return HttpResponse.json(characterView(character));
  }),

  http.post(`${BASE}/media-assets/upload`, async ({ request }) => {
    const file = await readUploadedFile(request);

    if (file === null) {
      return error(422, 'INVALID_IMAGE', 'Escolha uma imagem para enviar.');
    }

    mockState.calls.uploads.push({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const failure = takeFailure('upload');

    if (failure) {
      return failure;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return error(422, 'INVALID_IMAGE', 'Envie uma imagem JPEG, PNG ou WebP.');
    }

    const asset: MockAsset = {
      id: nextId('asset'),
      mimeType: file.type,
      storageKey: `content/images/${file.name}`,
      url: `https://cdn.example.com/images/${file.name}`,
    };

    mockState.assets.push(asset);

    return HttpResponse.json({ ...asset, kind: 'IMAGE' }, { status: 201 });
  }),

  // --- Taxonomia e banco de questões ---

  http.get(`${BASE}/skills`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q');
    const terms = q === null ? [] : normalize(q).split(/\s+/).filter(Boolean);

    mockState.calls.skillQueries.push(q ?? '');

    const failure = takeFailure('skills');

    if (failure) {
      return failure;
    }

    const data = mockState.skills.filter((candidate) => {
      const haystack = normalize(
        `${String(candidate.id)} ${String(candidate.title)}`,
      );

      return terms.every((term) => haystack.includes(term));
    });

    return HttpResponse.json({ data, nextCursor: null, hasMore: false });
  }),

  http.get(`${BASE}/register-notes`, () =>
    HttpResponse.json({
      data: mockState.registerNotes,
      nextCursor: null,
      hasMore: false,
    }),
  ),

  http.get(`${BASE}/error-patterns`, () =>
    HttpResponse.json({
      data: mockState.errorPatterns,
      nextCursor: null,
      hasMore: false,
    }),
  ),

  http.get(`${BASE}/items/:id`, ({ params }) => {
    const found = mockState.items.find(
      (candidate) => candidate.id === params.id,
    );

    return found === undefined ? notFound() : HttpResponse.json(found);
  }),

  http.get(`${BASE}/items`, ({ request }) => {
    const search = new URL(request.url).searchParams;

    mockState.calls.itemQueries.push(search.toString());

    const status = search.get('status');
    const level = search.get('level');
    const skillId = search.get('skillId');
    const data = mockState.items.filter(
      (candidate) =>
        (status === null || candidate.status === status) &&
        (level === null || candidate.cefrLevel === level) &&
        (skillId === null ||
          (candidate.skillIds as string[]).includes(skillId)),
    );

    return HttpResponse.json({ data, nextCursor: null, hasMore: false });
  }),
];
