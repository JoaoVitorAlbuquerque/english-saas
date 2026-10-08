import {
  normalizeAnswer,
  requestItemsDraftSchema,
  requestLessonDraftSchema,
  requestRegisterNotesDraftSchema,
  type DraftKind,
  type DraftStatus,
} from '@english-saas/shared';
import { http, HttpResponse } from 'msw';
import type { z } from 'zod';

import {
  API_URL,
  ITEM_AM_ID,
  ITEM_ORDER_ID,
  SKILL_BE,
  error,
  fullSteps,
  iso,
  item,
  mockState,
  nextId,
  notFound,
  studioHooks,
  takeFailure,
  type Json,
  type MockVersion,
} from './curriculum-mock';

/**
 * Estúdio de conteúdo simulado (módulo 5), com estado: rascunhos que andam
 * da fila até "pronto", revisão automática que **reavalia o conteúdo de
 * verdade** (corrigir a questão limpa o bloqueador), comentários, narração
 * que chega aos poucos depois da aprovação, nova geração de áudio e apostilas.
 *
 * Lê e escreve o mesmo `mockState` do conteúdo; a trava de QA na aprovação e
 * a de áudio na publicação entram pelo `studioHooks` do `curriculum-mock`.
 */

const BASE = `${API_URL}/admin/content-studio`;

type MockDraft = {
  id: string;
  kind: DraftKind;
  status: DraftStatus;
  params: Json;
  costUsdMicros: number | null;
  lessonVersionId: string | null;
  createdItemIds: string[];
  createdRegisterNoteIds: string[];
  errorCode: string | null;
  generatedAt: string | null;
  discardedAt: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string | null };
  qaReport: MockQaReport | null;
};

type MockWarning = {
  code: string;
  severity: 'BLOCKER' | 'WARNING' | 'INFO';
  message: string;
  path?: string;
};

type MockQaReport = {
  id: string;
  warnings: MockWarning[];
  levelStats: Json;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  ranAt: string;
};

export type MockComment = {
  id: string;
  versionId: string;
  target: string;
  targetRef: string | null;
  body: string;
  audioIssue: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  author: { id: string; name: string | null };
  createdAt: string;
};

type AudioEntry = { generated: boolean; revision: number; reads: number };

type MockJob = {
  id: string;
  reads: number;
  apply: () => void;
  applied: boolean;
};

type MockWorkbook = {
  id: string;
  generatedAt: string;
  sizeBytes: number;
  /** De que conteúdo publicado o PDF saiu. Mudou ⇒ desatualizada. */
  signature: string;
};

type StudioState = {
  drafts: MockDraft[];
  qa: Map<string, MockQaReport>;
  comments: MockComment[];
  audio: Map<string, Map<string, AudioEntry>>;
  workbooks: Map<string, MockWorkbook>;
  jobs: Map<string, MockJob>;
  /** Custo médio por rascunho (lição) ou por questão/nota; `null` = sem histórico. */
  estimates: Record<
    DraftKind,
    { perUnitUsdMicros: number; basedOn: number } | null
  >;
  /** Cada leitura da lista de rascunhos avança um estágio (como o job andando). */
  autoAdvance: boolean;
  /** Quantas leituras do job até ele terminar (1 = termina na primeira). */
  jobReads: number;
  /**
   * A narração da aprovação termina na hora (o padrão: os testes do editor não
   * têm por que esperar o worker). Desligue para ver o áudio chegar aos poucos.
   */
  instantNarration: boolean;
  /** A próxima geração falha com este código. */
  failNextGeneration: string | null;
  calls: {
    draftRequests: { kind: DraftKind; body: Json }[];
    draftListQueries: string[];
    estimateQueries: string[];
    discards: string[];
    qaRuns: string[];
    commentWrites: Json[];
    resolvedComments: string[];
    regenerations: { versionId: string; body: Json }[];
    workbookRegenerations: string[];
  };
};

function signatureOf(unitId: string): string {
  return mockState.lessons
    .filter((lesson) => lesson.unitId === unitId)
    .map((lesson) => lesson.publishedVersionId ?? '-')
    .join('|');
}

function initialState(): StudioState {
  return {
    drafts: [
      {
        id: 'draft-queued',
        kind: 'LESSON',
        status: 'QUEUED',
        params: {
          objective: 'Pedir comida num restaurante.',
          level: 'A1',
          slug: 'at-the-restaurant',
        },
        costUsdMicros: null,
        lessonVersionId: null,
        createdItemIds: [],
        createdRegisterNoteIds: [],
        errorCode: null,
        generatedAt: null,
        discardedAt: null,
        createdAt: iso(6),
        requestedBy: { id: 'user-3', name: 'Bruno Lima' },
        qaReport: null,
      },
      {
        id: 'draft-failed',
        kind: 'LESSON',
        status: 'FAILED',
        params: { objective: 'Falar da rotina.', level: 'A2' },
        costUsdMicros: 12_000,
        lessonVersionId: null,
        createdItemIds: [],
        createdRegisterNoteIds: [],
        errorCode: 'DRAFT_REQUEST_INVALID',
        generatedAt: null,
        discardedAt: null,
        createdAt: iso(5),
        requestedBy: { id: 'user-1', name: 'Editora Teste' },
        qaReport: null,
      },
      {
        id: 'draft-items-ready',
        kind: 'ITEMS',
        status: 'READY',
        params: {
          skillId: SKILL_BE,
          level: 'A1',
          count: 2,
          types: ['MULTIPLE_CHOICE', 'ORDER_WORDS'],
        },
        costUsdMicros: 6_400,
        lessonVersionId: null,
        createdItemIds: [ITEM_ORDER_ID, ITEM_AM_ID],
        createdRegisterNoteIds: [],
        errorCode: null,
        generatedAt: iso(4),
        discardedAt: null,
        createdAt: iso(4),
        requestedBy: { id: 'user-1', name: 'Editora Teste' },
        qaReport: {
          id: 'qa-items',
          warnings: [],
          levelStats: {},
          blockerCount: 0,
          warningCount: 0,
          infoCount: 0,
          ranAt: iso(4),
        },
      },
      {
        id: 'draft-notes-ready',
        kind: 'REGISTER_NOTES',
        status: 'READY',
        params: { level: 'A2', count: 3 },
        costUsdMicros: 2_100,
        lessonVersionId: null,
        createdItemIds: [],
        createdRegisterNoteIds: ['gonna'],
        errorCode: null,
        generatedAt: iso(3),
        discardedAt: null,
        createdAt: iso(3),
        requestedBy: { id: 'user-3', name: 'Bruno Lima' },
        qaReport: null,
      },
    ],
    qa: new Map(),
    comments: [],
    audio: new Map(),
    workbooks: new Map([
      [
        'unit-1',
        {
          id: 'workbook-1',
          generatedAt: iso(5),
          sizeBytes: 48_000,
          signature: signatureOf('unit-1'),
        },
      ],
    ]),
    jobs: new Map(),
    estimates: {
      LESSON: { perUnitUsdMicros: 42_000, basedOn: 6 },
      ITEMS: { perUnitUsdMicros: 3_200, basedOn: 4 },
      REGISTER_NOTES: null,
    },
    autoAdvance: false,
    jobReads: 1,
    instantNarration: true,
    failNextGeneration: null,
    calls: {
      draftRequests: [],
      draftListQueries: [],
      estimateQueries: [],
      discards: [],
      qaRuns: [],
      commentWrites: [],
      resolvedComments: [],
      regenerations: [],
      workbookRegenerations: [],
    },
  };
}

export let studioState: StudioState = initialState();

export function resetStudioMock(): void {
  studioState = initialState();
}

export const UNIT_1_UUID = '10000000-0000-4000-8000-000000000001';
export const UNIT_2_UUID = '10000000-0000-4000-8000-000000000002';
export const LESSON_1_UUID = '20000000-0000-4000-8000-000000000001';
export const LESSON_2_UUID = '20000000-0000-4000-8000-000000000002';

/**
 * Troca os ids de unidade e de lição do conteúdo-base (`unit-1`, `lesson-1`…)
 * por UUIDs. A API exige UUID nos pedidos de rascunho e o formulário confere
 * isso; os testes que pedem lição precisam de ids que passem.
 */
export function giveUuidsToContent(): void {
  const renamed = new Map([
    ['unit-1', UNIT_1_UUID],
    ['unit-2', UNIT_2_UUID],
    ['lesson-1', LESSON_1_UUID],
    ['lesson-2', LESSON_2_UUID],
  ]);
  const swap = (id: string): string => renamed.get(id) ?? id;

  for (const unit of mockState.units) {
    unit.id = swap(unit.id);
  }

  for (const lesson of mockState.lessons) {
    lesson.id = swap(lesson.id);
    lesson.unitId = swap(lesson.unitId);
  }

  for (const version of mockState.versions) {
    version.lessonId = swap(version.lessonId);
  }

  studioState.workbooks = new Map(
    [...studioState.workbooks].map(([unitId, workbook]) => [
      swap(unitId),
      workbook,
    ]),
  );
}

// ---------------------------------------------------------------------------
// Revisão automática: as mesmas regras de questão do servidor
// ---------------------------------------------------------------------------

const LEVEL_STATS: Json = {
  totalWords: 140,
  outOfLevelCount: 7,
  ratio: 0.05,
  coverage: 0.82,
  outOfLevel: [
    { word: 'neighbourhood', band: 'B1' },
    { word: 'apartment', band: 'A2' },
  ],
  wordlistSize: 5000,
};

function practiceItems(version: MockVersion): Json[] {
  return version.steps
    .filter((step) => step.type === 'PRACTICE')
    .flatMap((step) => {
      const ids = (step.content as { itemIds?: string[] }).itemIds ?? [];

      return ids.flatMap((id) => {
        const found = mockState.items.find((entry) => entry['id'] === id);

        return found === undefined ? [] : [found];
      });
    });
}

function checkItem(entry: Json, index: number): MockWarning[] {
  const path = `items.${String(index)}`;
  const content = (entry['content'] ?? {}) as Json;
  const accepted = (entry['acceptedAnswers'] ?? []) as string[];

  if (entry['type'] === 'ORDER_WORDS') {
    const tokens = ((content['tokens'] ?? []) as unknown[]).map(String);
    const words = (text: string) =>
      normalizeAnswer(text).split(' ').filter(Boolean).sort().join(' ');
    const fits = accepted.some(
      (answer) => words(answer) === words(tokens.join(' ')),
    );

    return fits
      ? []
      : [
          {
            code: 'ORDER_WORDS_TOKENS_MISMATCH',
            severity: 'BLOCKER',
            message: `As peças (${tokens.join(' / ')}) não montam nenhuma das respostas aceitas.`,
            path,
          },
        ];
  }

  if (entry['type'] === 'FILL_BLANK') {
    const sentence = String(content['sentence'] ?? '');
    const blanks = sentence.split('___').length - 1;

    return blanks === accepted.length
      ? []
      : [
          {
            code: 'FILL_BLANK_COUNT_MISMATCH',
            severity: 'BLOCKER',
            message: `A frase tem ${String(blanks)} lacuna(s) e ${String(accepted.length)} resposta(s) aceita(s).`,
            path,
          },
        ];
  }

  if (entry['type'] === 'MULTIPLE_CHOICE') {
    const options = (content['options'] ?? []) as {
      id: string;
      text: string;
    }[];
    const correct = (content['correctOptionIds'] ?? []) as string[];
    const valid = correct.filter((id) =>
      options.some((option) => option.id === id),
    );

    if (valid.length === 0) {
      return [
        {
          code: 'ITEM_WITHOUT_ANSWER',
          severity: 'BLOCKER',
          message: 'A questão não tem gabarito.',
          path,
        },
      ];
    }

    const texts = options
      .filter((option) => valid.includes(option.id))
      .map((option) => option.text);
    const explanation = String(entry['explanation'] ?? '').toLowerCase();

    return texts.some((text) => explanation.includes(text.toLowerCase()))
      ? []
      : [
          {
            code: 'ANSWER_EXPLANATION_MISMATCH',
            severity: 'INFO',
            message: `A explicação não cita a alternativa certa ("${texts.join('", "')}").`,
            path,
          },
        ];
  }

  return [];
}

const WEIGHT = { BLOCKER: 0, WARNING: 1, INFO: 2 } as const;

function buildReport(
  version: MockVersion,
  extra: MockWarning[] = [],
): MockQaReport {
  const warnings: MockWarning[] = (
    [
      ...extra,
      ...practiceItems(version).flatMap((entry, index) =>
        checkItem(entry, index),
      ),
      {
        code: 'LANGUAGE_ISSUE',
        severity: 'WARNING',
        message:
          'Soa pouco natural. (trecho: "I\'m gonna live" → sugestão: "I\'m going to live")',
        path: 'steps.0.lines.1',
      },
      {
        code: 'SKILL_NOT_IN_ITEMS',
        severity: 'WARNING',
        message: `A skill "${SKILL_BE}" é alvo da lição mas nenhum item da prática mede ela.`,
        path: 'targetSkills',
      },
      {
        code: 'LEVEL_ABOVE_TARGET',
        severity: 'WARNING',
        message:
          '5.0% das palavras estão acima de A1 (teto: 5%). Fora do nível: neighbourhood (B1), apartment (A2).',
        path: 'level',
      },
    ] as MockWarning[]
  ).sort(
    (a, b) =>
      WEIGHT[a.severity] - WEIGHT[b.severity] ||
      (a.path ?? '').localeCompare(b.path ?? ''),
  );

  const count = (severity: MockWarning['severity']) =>
    warnings.filter((warning) => warning.severity === severity).length;

  return {
    id: nextId('qa'),
    warnings,
    levelStats: LEVEL_STATS,
    blockerCount: count('BLOCKER'),
    warningCount: count('WARNING'),
    infoCount: count('INFO'),
    ranAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Rascunhos: o que o job faz em cada estágio
// ---------------------------------------------------------------------------

let itemSeed = 0;

function newItemId(): string {
  itemSeed += 1;

  return `00000000-0000-4000-8000-${String(itemSeed).padStart(12, '0')}`;
}

function generateItems(level: string): { id: string }[] {
  const created: Json[] = [
    item(newItemId(), 'ORDER_WORDS', 'Monte a frase.', level, {
      // Defeito de propósito: as peças não montam a resposta aceita.
      content: { tokens: ['I', 'am', 'Lucas'] },
      acceptedAnswers: ['I am Maya'],
      explanation: 'Sujeito, verbo, nome.',
      status: 'DRAFT',
      source: 'AI_DRAFT',
    }),
    item(newItemId(), 'FILL_BLANK', 'Complete a frase.', level, {
      // Defeito de propósito: duas lacunas e uma resposta.
      content: { sentence: 'She ___ from ___.' },
      acceptedAnswers: ['is'],
      explanation: 'Com "she", o verbo é "is".',
      status: 'DRAFT',
      source: 'AI_DRAFT',
    }),
    item(newItemId(), 'MULTIPLE_CHOICE', 'I ___ Maya.', level, {
      content: {
        options: [
          { id: 'am', text: 'am' },
          { id: 'is', text: 'is' },
        ],
        correctOptionIds: ['am'],
        shuffle: false,
      },
      // A explicação não cita a alternativa certa: aviso INFO.
      explanation: 'Depende da pessoa.',
      status: 'DRAFT',
      source: 'AI_DRAFT',
    }),
  ];

  mockState.items.push(...created);

  return created.map((entry) => ({ id: String(entry['id']) }));
}

function materializeLesson(draft: MockDraft): void {
  const params = draft.params;
  const level = String(params['level'] ?? 'A1');
  const items = generateItems(level);
  let lesson = mockState.lessons.find(
    (candidate) => candidate.id === params['lessonId'],
  );
  const now = new Date().toISOString();

  if (lesson === undefined) {
    lesson = {
      id: nextId('lesson'),
      unitId: String(params['unitId'] ?? 'unit-2'),
      slug: String(params['slug'] ?? nextId('licao')),
      order: Number(params['order'] ?? 0),
      publishedVersionId: null,
    };
    mockState.lessons.push(lesson);
  }

  const versionNumber =
    mockState.versions.filter((version) => version.lessonId === lesson.id)
      .length + 1;
  const steps = fullSteps(`gen-${String(mockState.counter)}`).map((step) =>
    step.type === 'PRACTICE'
      ? {
          ...step,
          content: { itemIds: items.map((entry) => entry.id), shuffle: false },
        }
      : step,
  );
  const version: MockVersion = {
    id: nextId('version'),
    lessonId: lesson.id,
    version: versionNumber,
    status: 'DRAFT',
    title: String(params['title'] ?? 'Lição gerada pela IA'),
    objective: String(params['objective'] ?? ''),
    cefrLevel: level,
    estimatedMinutes: 12,
    approvedAt: null,
    approvedById: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    steps,
    targetSkillIds: (
      (params['targetSkillIds'] as string[] | undefined) ?? [SKILL_BE]
    ).slice(),
  };

  mockState.versions.push(version);
  draft.lessonVersionId = version.id;
  draft.createdItemIds = items.map((entry) => entry.id);
  draft.costUsdMicros = 43_500;
  draft.generatedAt = now;
  // O aviso do mapeamento da IA é gravado só no primeiro relatório.
  draft.qaReport = buildReport(version, [
    {
      code: 'SPAN_TEXT_NOT_FOUND',
      severity: 'WARNING',
      message:
        'O trecho "Austin" que a IA mandou marcar não foi achado no texto.',
      path: 'scene.lines.0.spans.0',
    },
  ]);
  studioState.qa.set(version.id, draft.qaReport);
}

function materializeItems(draft: MockDraft): void {
  const items = generateItems(String(draft.params['level'] ?? 'A1'));

  draft.createdItemIds = items.map((entry) => entry.id);
  draft.costUsdMicros = 7_100;
  draft.generatedAt = new Date().toISOString();
  draft.qaReport = {
    id: nextId('qa'),
    warnings: [],
    levelStats: {},
    blockerCount: 0,
    warningCount: 0,
    infoCount: 0,
    ranAt: draft.generatedAt,
  };
}

/**
 * Corrige as duas questões com defeito da lição gerada, como se o editor
 * tivesse ido ao editor de questão (a revisão só vê o conserto ao rodar de novo).
 */
export function fixGeneratedItems(versionId: string): void {
  const version = mockState.versions.find((entry) => entry.id === versionId);
  const practice = version?.steps.find((step) => step.type === 'PRACTICE')
    ?.content as { itemIds: string[] } | undefined;

  for (const entry of mockState.items) {
    if (entry['id'] === practice?.itemIds[0]) {
      entry['acceptedAnswers'] = ['I am Lucas'];
    }

    if (entry['id'] === practice?.itemIds[1]) {
      entry['content'] = { sentence: 'She ___ from Austin.' };
    }
  }
}

/** Um estágio adiante, como o job da fila andando. */
export function advanceDraft(draft: MockDraft): void {
  if (draft.status === 'QUEUED') {
    draft.status = 'GENERATING';

    return;
  }

  if (draft.status === 'GENERATING') {
    if (studioState.failNextGeneration !== null) {
      draft.status = 'FAILED';
      draft.errorCode = studioState.failNextGeneration;
      studioState.failNextGeneration = null;

      return;
    }

    if (draft.kind === 'LESSON') {
      materializeLesson(draft);
      draft.status = 'QA_RUNNING';
    } else if (draft.kind === 'ITEMS') {
      materializeItems(draft);
      draft.status = 'QA_RUNNING';
    } else {
      draft.createdRegisterNoteIds = ['gonna'];
      draft.costUsdMicros = 2_300;
      draft.generatedAt = new Date().toISOString();
      draft.status = 'READY';
    }

    return;
  }

  if (draft.status === 'QA_RUNNING') {
    draft.status = 'READY';
  }
}

/** Avança todos os rascunhos em andamento `times` estágios. */
export function advanceDrafts(times = 1): void {
  for (let step = 0; step < times; step += 1) {
    for (const draft of studioState.drafts) {
      advanceDraft(draft);
    }
  }
}

/**
 * Um rascunho de lição pronto, já com a versão em DRAFT, as questões (duas
 * com bloqueador) e o relatório de revisão. Para os testes que começam na
 * revisão sem esperar a geração.
 */
export function seedReadyLessonDraft(): { draftId: string; versionId: string } {
  const draft: MockDraft = {
    id: nextId('draft'),
    kind: 'LESSON',
    status: 'GENERATING',
    params: {
      unitId: 'unit-2',
      slug: 'at-the-airport',
      order: 0,
      title: 'At the airport',
      objective: 'Fazer o check-in no aeroporto.',
      level: 'A1',
      targetSkillIds: [SKILL_BE],
    },
    costUsdMicros: null,
    lessonVersionId: null,
    createdItemIds: [],
    createdRegisterNoteIds: [],
    errorCode: null,
    generatedAt: null,
    discardedAt: null,
    createdAt: new Date().toISOString(),
    requestedBy: { id: 'user-1', name: 'Editora Teste' },
    qaReport: null,
  };

  advanceDraft(draft);
  advanceDraft(draft);
  studioState.drafts.unshift(draft);

  return { draftId: draft.id, versionId: draft.lessonVersionId as string };
}

// ---------------------------------------------------------------------------
// Áudio
// ---------------------------------------------------------------------------

type AudioTarget = {
  key: string;
  kind: 'SCENE_LINE' | 'ITEM';
  text: string;
  label: string | null;
  stepOrder: number | null;
  lineIndex: number | null;
  itemId: string | null;
};

function audioPlan(version: MockVersion): AudioTarget[] {
  const targets: AudioTarget[] = [];

  for (const step of version.steps) {
    if (step.type === 'SCENE') {
      const lines =
        (step.content as { lines?: { characterId: string; text: string }[] })
          .lines ?? [];

      for (const [index, line] of lines.entries()) {
        targets.push({
          key: `scene:${String(step.order)}:${String(index)}`,
          kind: 'SCENE_LINE',
          text: line.text,
          label:
            mockState.characters.find((c) => c.id === line.characterId)?.name ??
            null,
          stepOrder: step.order,
          lineIndex: index,
          itemId: null,
        });
      }
    }
  }

  for (const entry of practiceItems(version)) {
    const content = (entry['content'] ?? {}) as Json;

    if (
      (entry['type'] === 'LISTEN_CHOOSE' || entry['type'] === 'DICTATION') &&
      typeof content['audioText'] === 'string'
    ) {
      targets.push({
        key: `item:${String(entry['id'])}`,
        kind: 'ITEM',
        text: content['audioText'],
        label: String(entry['prompt']),
        stepOrder: null,
        lineIndex: null,
        itemId: String(entry['id']),
      });
    }
  }

  return targets;
}

/** O mapa de áudio da versão; criado na primeira leitura. */
function audioOf(version: MockVersion): Map<string, AudioEntry> {
  let entries = studioState.audio.get(version.id);

  if (entries === undefined) {
    // Versão que já foi ao ar tem narração; rascunho e revisão, não. A aprovada
    // tem, se a narração da fila já terminou.
    const done =
      version.status === 'PUBLISHED' ||
      version.status === 'ARCHIVED' ||
      (version.status === 'APPROVED' && studioState.instantNarration);

    entries = new Map(
      audioPlan(version).map((target) => [
        target.key,
        { generated: done, revision: 0, reads: 0 },
      ]),
    );
    studioState.audio.set(version.id, entries);
  }

  for (const target of audioPlan(version)) {
    if (!entries.has(target.key)) {
      entries.set(target.key, { generated: false, revision: 0, reads: 0 });
    }
  }

  return entries;
}

/** Termina a narração da versão de uma vez (o worker acabou). */
export function finishNarration(versionId: string): void {
  const version = mockState.versions.find((entry) => entry.id === versionId);

  if (version === undefined) {
    return;
  }

  for (const entry of audioOf(version).values()) {
    entry.generated = true;
  }
}

function audioView(version: MockVersion): Json {
  const entries = audioOf(version);

  // A narração roda na fila depois da aprovação: termina na segunda leitura.
  if (version.status === 'APPROVED') {
    for (const entry of entries.values()) {
      if (!entry.generated) {
        entry.reads += 1;

        if (entry.reads >= 2) {
          entry.generated = true;
        }
      }
    }
  }

  const targets = audioPlan(version).map((target) => {
    const entry = entries.get(target.key) as AudioEntry;

    return {
      ...target,
      registerNoteId: null,
      audio: entry.generated
        ? {
            url: `http://localhost/audio/${encodeURIComponent(target.key)}-r${String(entry.revision)}.mp3`,
            mimeType: 'audio/mpeg',
            durationMs: 1_200,
          }
        : null,
      openIssues: studioState.comments
        .filter(
          (comment) =>
            comment.versionId === version.id &&
            comment.target === 'AUDIO' &&
            comment.targetRef === target.key &&
            comment.resolvedAt === null,
        )
        .map((comment) => ({
          id: comment.id,
          audioIssue: comment.audioIssue,
          body: comment.body,
          createdAt: comment.createdAt,
        })),
    };
  });

  return {
    versionStatus: version.status,
    total: targets.length,
    pending: targets.filter((target) => target.audio === null).length,
    targets,
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

function startJob(apply: () => void): { jobId: string; queue: string } {
  const id = nextId('job');

  studioState.jobs.set(id, { id, reads: 0, apply, applied: false });

  return { jobId: id, queue: 'media' };
}

// ---------------------------------------------------------------------------
// Gatilhos nas transições da versão (aprovar e publicar)
// ---------------------------------------------------------------------------

function pendingKeys(version: MockVersion): string[] {
  return [...audioOf(version).entries()]
    .filter(([, entry]) => !entry.generated)
    .map(([key]) => key);
}

studioHooks.before = (action, version) => {
  if (action === 'approve') {
    const report = studioState.qa.get(version.id);

    if (report !== undefined && report.blockerCount > 0) {
      return error(
        409,
        'QA_BLOCKERS',
        `A revisão automática encontrou ${String(report.blockerCount)} problema(s) que precisam ser corrigidos antes de aprovar.`,
        {
          blockers: report.warnings
            .filter((warning) => warning.severity === 'BLOCKER')
            .map((warning) => ({
              code: warning.code,
              message: warning.message,
              path: warning.path ?? null,
            })),
        },
      );
    }
  }

  if (action === 'publish') {
    const missing = pendingKeys(version);

    if (missing.length > 0) {
      return error(
        409,
        'MISSING_AUDIO',
        `${String(missing.length)} trecho(s) ainda estão sem áudio. Gere a narração antes de publicar.`,
        { missing },
      );
    }
  }

  return null;
};

studioHooks.after = (action, version) => {
  if (action === 'approve') {
    // A narração entra na fila na aprovação: tudo começa sem áudio.
    studioState.audio.delete(version.id);

    for (const entry of audioOf(version).values()) {
      entry.generated = studioState.instantNarration;
    }

    // Aprovar a lição publica as questões dela.
    for (const entry of practiceItems(version)) {
      if (entry['status'] !== 'PUBLISHED') {
        entry['status'] = 'PUBLISHED';

        if (entry['source'] === 'AI_DRAFT') {
          entry['source'] = 'AI_DRAFT_REVIEWED';
        }
      }
    }
  }

  if (action === 'publish') {
    const lesson = mockState.lessons.find((l) => l.id === version.lessonId);

    if (lesson !== undefined) {
      // Publicar regera a apostila da unidade (o worker é rápido aqui).
      studioState.workbooks.set(lesson.unitId, {
        id: studioState.workbooks.get(lesson.unitId)?.id ?? nextId('workbook'),
        generatedAt: new Date().toISOString(),
        sizeBytes: 52_000,
        signature: signatureOf(lesson.unitId),
      });
    }
  }
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function draftView(draft: MockDraft): Json {
  return {
    id: draft.id,
    kind: draft.kind,
    status: draft.status,
    params: draft.params,
    promptId: draft.costUsdMicros === null ? null : `draft-${draft.kind}`,
    promptVersion: draft.costUsdMicros === null ? null : 1,
    model: draft.costUsdMicros === null ? null : 'fake-smart',
    costUsdMicros: draft.costUsdMicros,
    lessonVersionId: draft.lessonVersionId,
    createdItemIds: draft.createdItemIds,
    createdRegisterNoteIds: draft.createdRegisterNoteIds,
    errorCode: draft.errorCode,
    generatedAt: draft.generatedAt,
    discardedAt: draft.discardedAt,
    createdAt: draft.createdAt,
    requestedBy: draft.requestedBy,
    qaReports: draft.qaReport === null ? [] : [draft.qaReport],
  };
}

function validationError(issues: z.core.$ZodIssue[]): Response {
  return error(400, 'VALIDATION_ERROR', 'Há campos com problema no pedido.', {
    issues: issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })),
  });
}

async function createDraft<T extends z.ZodType>(
  request: Request,
  kind: DraftKind,
  schema: T,
): Promise<Response> {
  const body = (await request.json()) as Json;
  const failure = takeFailure('draft-request');

  if (failure) {
    return failure;
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  studioState.calls.draftRequests.push({ kind, body });

  const draft: MockDraft = {
    id: nextId('draft'),
    kind,
    status: 'QUEUED',
    params: parsed.data as Json,
    costUsdMicros: null,
    lessonVersionId: null,
    createdItemIds: [],
    createdRegisterNoteIds: [],
    errorCode: null,
    generatedAt: null,
    discardedAt: null,
    createdAt: new Date().toISOString(),
    requestedBy: { id: 'user-1', name: 'Editora Teste' },
    qaReport: null,
  };

  studioState.drafts.unshift(draft);

  return HttpResponse.json(draftView(draft), { status: 202 });
}

function findVersion(id: string): MockVersion | undefined {
  return mockState.versions.find((version) => version.id === id);
}

export const studioHandlers = [
  http.get(`${BASE}/drafts/estimate`, ({ request }) => {
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind') as DraftKind;
    const count = Number(url.searchParams.get('count') ?? '1');

    studioState.calls.estimateQueries.push(url.search);

    const entry = studioState.estimates[kind];

    return HttpResponse.json({
      usdMicros:
        entry === null
          ? null
          : Math.round(
              entry.perUnitUsdMicros * (kind === 'LESSON' ? 1 : count),
            ),
      basedOn: entry?.basedOn ?? 0,
    });
  }),

  http.get(`${BASE}/drafts`, ({ request }) => {
    const url = new URL(request.url);

    studioState.calls.draftListQueries.push(url.search);

    const failure = takeFailure('drafts-list');

    if (failure) {
      return failure;
    }

    if (studioState.autoAdvance) {
      advanceDrafts();
    }

    const status = url.searchParams.get('status');
    const kind = url.searchParams.get('kind');
    const limit = Number(url.searchParams.get('limit') ?? '30');
    const start = Number(url.searchParams.get('cursor') ?? '0');
    const rows = studioState.drafts.filter(
      (draft) =>
        (status === null || draft.status === status) &&
        (kind === null || draft.kind === kind),
    );
    const page = rows.slice(start, start + limit);
    const hasMore = start + limit < rows.length;

    return HttpResponse.json({
      data: page.map(draftView),
      nextCursor: hasMore ? String(start + limit) : null,
      hasMore,
    });
  }),

  http.post(`${BASE}/drafts/lesson`, ({ request }) =>
    createDraft(request, 'LESSON', requestLessonDraftSchema),
  ),
  http.post(`${BASE}/drafts/items`, ({ request }) =>
    createDraft(request, 'ITEMS', requestItemsDraftSchema),
  ),
  http.post(`${BASE}/drafts/register-notes`, ({ request }) =>
    createDraft(request, 'REGISTER_NOTES', requestRegisterNotesDraftSchema),
  ),

  http.get(`${BASE}/drafts/:id`, ({ params }) => {
    const draft = studioState.drafts.find((entry) => entry.id === params.id);

    return draft === undefined
      ? notFound()
      : HttpResponse.json(draftView(draft));
  }),

  http.post(`${BASE}/drafts/:id/discard`, ({ params }) => {
    const draft = studioState.drafts.find((entry) => entry.id === params.id);

    if (draft === undefined) {
      return notFound();
    }

    const failure = takeFailure('draft-discard');

    if (failure) {
      return failure;
    }

    studioState.calls.discards.push(draft.id);

    for (const entry of mockState.items) {
      if (
        draft.createdItemIds.includes(String(entry['id'])) &&
        entry['status'] !== 'PUBLISHED'
      ) {
        entry['status'] = 'ARCHIVED';
      }
    }

    const version = draft.lessonVersionId
      ? findVersion(draft.lessonVersionId)
      : undefined;

    if (
      version !== undefined &&
      (version.status === 'DRAFT' || version.status === 'IN_REVIEW')
    ) {
      version.status = 'ARCHIVED';
    }

    draft.status = 'DISCARDED';
    draft.discardedAt = new Date().toISOString();

    return HttpResponse.json(draftView(draft), { status: 201 });
  }),

  // --- Revisão automática ---

  http.get(`${BASE}/qa/lesson-versions/:id`, ({ params }) => {
    const failure = takeFailure('qa-get');

    if (failure) {
      return failure;
    }

    const report = studioState.qa.get(String(params.id));

    return report === undefined
      ? error(404, 'NOT_FOUND', 'A QA ainda não rodou nesta versão.')
      : HttpResponse.json(report);
  }),

  http.post(`${BASE}/qa/lesson-versions/:id`, ({ params }) => {
    const version = findVersion(String(params.id));

    if (version === undefined) {
      return notFound();
    }

    studioState.calls.qaRuns.push(version.id);

    const failure = takeFailure('qa-run');

    if (failure) {
      return failure;
    }

    const report = buildReport(version);

    studioState.qa.set(version.id, report);

    return HttpResponse.json(report, { status: 201 });
  }),

  // --- Comentários ---

  http.get(`${BASE}/lesson-versions/:id/comments`, ({ params, request }) => {
    const includeResolved =
      new URL(request.url).searchParams.get('includeResolved') === 'true';

    return HttpResponse.json(
      studioState.comments
        .filter(
          (comment) =>
            comment.versionId === params.id &&
            (includeResolved || comment.resolvedAt === null),
        )
        .map(({ versionId: _versionId, ...comment }) => comment),
    );
  }),

  http.post(
    `${BASE}/lesson-versions/:id/comments`,
    async ({ params, request }) => {
      const body = (await request.json()) as Json;
      const failure = takeFailure('comment-add');

      if (failure) {
        return failure;
      }

      if (findVersion(String(params.id)) === undefined) {
        return notFound();
      }

      const target = String(body['target'] ?? 'VERSION');
      const text = String(body['body'] ?? '').trim();

      if (target === 'AUDIO' && body['audioIssue'] === undefined) {
        return validationError([
          {
            code: 'custom',
            path: ['audioIssue'],
            message: 'Diga qual é o problema do áudio.',
          },
        ]);
      }

      if (target !== 'AUDIO' && text === '') {
        return validationError([
          { code: 'custom', path: ['body'], message: 'Escreva o comentário.' },
        ]);
      }

      studioState.calls.commentWrites.push(body);

      const comment: MockComment = {
        id: nextId('comment'),
        versionId: String(params.id),
        target,
        targetRef:
          typeof body['targetRef'] === 'string' ? body['targetRef'] : null,
        body: text,
        audioIssue:
          typeof body['audioIssue'] === 'string' ? body['audioIssue'] : null,
        resolvedAt: null,
        resolvedById: null,
        author: { id: 'user-1', name: 'Editora Teste' },
        createdAt: new Date().toISOString(),
      };

      studioState.comments.push(comment);

      const { versionId: _versionId, author: _author, ...created } = comment;

      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.post(`${BASE}/comments/:id/resolve`, ({ params }) => {
    const comment = studioState.comments.find(
      (entry) => entry.id === params.id,
    );

    if (comment === undefined) {
      return notFound();
    }

    studioState.calls.resolvedComments.push(comment.id);
    comment.resolvedAt = new Date().toISOString();
    comment.resolvedById = 'user-1';

    return HttpResponse.json(
      {
        id: comment.id,
        resolvedAt: comment.resolvedAt,
        resolvedById: comment.resolvedById,
      },
      { status: 201 },
    );
  }),

  // --- Áudio ---

  http.get(`${BASE}/lesson-versions/:id/audio`, ({ params }) => {
    const failure = takeFailure('audio-list');

    if (failure) {
      return failure;
    }

    const version = findVersion(String(params.id));

    return version === undefined
      ? notFound()
      : HttpResponse.json(audioView(version));
  }),

  http.post(
    `${BASE}/lesson-versions/:id/audio/regenerate`,
    async ({ params, request }) => {
      const body = (await request.json()) as {
        keys: string[];
        speakingRate?: number;
      };
      const version = findVersion(String(params.id));

      if (version === undefined) {
        return notFound();
      }

      const failure = takeFailure('audio-regenerate');

      if (failure) {
        return failure;
      }

      if (version.status !== 'APPROVED') {
        return error(
          409,
          'AUDIO_REGENERATION_NOT_ALLOWED',
          'O áudio só pode ser gerado de novo depois que a versão for aprovada.',
          { status: version.status },
        );
      }

      const entries = audioOf(version);
      const unknown = body.keys.filter((key) => !entries.has(key));

      if (unknown.length > 0) {
        return error(
          422,
          'UNKNOWN_AUDIO_KEY',
          'Algum dos áudios pedidos não existe nesta versão.',
          { keys: unknown },
        );
      }

      studioState.calls.regenerations.push({
        versionId: version.id,
        body: body as unknown as Json,
      });

      return HttpResponse.json(
        startJob(() => {
          for (const key of body.keys) {
            const entry = entries.get(key);

            if (entry !== undefined) {
              entry.generated = true;
              entry.revision += 1;
            }
          }
        }),
        { status: 202 },
      );
    },
  ),

  // --- Apostilas e jobs ---

  http.get(`${BASE}/workbooks`, () => {
    const failure = takeFailure('workbooks-list');

    if (failure) {
      return failure;
    }

    const levelOrder = (levelId: string) =>
      mockState.levels.find((level) => level.id === levelId)?.order ?? 0;
    const units = [...mockState.units].sort(
      (a, b) =>
        levelOrder(a.levelId) - levelOrder(b.levelId) || a.order - b.order,
    );

    return HttpResponse.json(
      units.map((unit) => {
        const workbook = studioState.workbooks.get(unit.id);

        return {
          unit: { id: unit.id, slug: unit.slug, title: unit.title },
          cefrLevel:
            mockState.levels.find((level) => level.id === unit.levelId)
              ?.cefrLevel ?? 'A1',
          publishedLessons: mockState.lessons.filter(
            (lesson) =>
              lesson.unitId === unit.id && lesson.publishedVersionId !== null,
          ).length,
          workbook:
            workbook === undefined
              ? null
              : {
                  id: workbook.id,
                  status: 'PUBLISHED',
                  generatedAt: workbook.generatedAt,
                  sizeBytes: workbook.sizeBytes,
                  url: `http://localhost/pdf/${unit.slug}.pdf`,
                  stale: workbook.signature !== signatureOf(unit.id),
                },
        };
      }),
    );
  }),

  http.post(`${BASE}/units/:id/workbook`, ({ params }) => {
    const unit = mockState.units.find((entry) => entry.id === params.id);

    if (unit === undefined) {
      return notFound();
    }

    const failure = takeFailure('workbook-regenerate');

    if (failure) {
      return failure;
    }

    studioState.calls.workbookRegenerations.push(unit.id);

    return HttpResponse.json(
      startJob(() => {
        studioState.workbooks.set(unit.id, {
          id: studioState.workbooks.get(unit.id)?.id ?? nextId('workbook'),
          generatedAt: new Date().toISOString(),
          sizeBytes: 55_000,
          signature: signatureOf(unit.id),
        });
      }),
      { status: 202 },
    );
  }),

  http.get(`${BASE}/jobs/:id`, ({ params }) => {
    const job = studioState.jobs.get(String(params.id));

    if (job === undefined) {
      return HttpResponse.json({
        id: String(params.id),
        state: 'unknown',
        failedReason: null,
      });
    }

    job.reads += 1;

    if (job.reads >= studioState.jobReads) {
      if (!job.applied) {
        job.applied = true;
        job.apply();
      }

      return HttpResponse.json({
        id: job.id,
        state: 'completed',
        failedReason: null,
      });
    }

    return HttpResponse.json({
      id: job.id,
      state: job.reads === 1 ? 'waiting' : 'active',
      failedReason: null,
    });
  }),
];
