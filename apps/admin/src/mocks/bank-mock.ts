import {
  INITIAL_DIFFICULTY_BY_LEVEL,
  errorPatternAuthoringPatchSchema,
  errorPatternAuthoringSchema,
  immutableFieldChanges,
  issueMessage,
  itemAuthoringPatchSchema,
  itemAuthoringSchema,
  registerNoteAuthoringPatchSchema,
  registerNoteAuthoringSchema,
  requiresNewItem,
  skillAuthoringPatchSchema,
  skillAuthoringSchema,
  validateItem,
  type CefrLevel,
  type ContentStatus,
} from '@english-saas/shared';
import { http, HttpResponse } from 'msw';
import type { z } from 'zod';

import {
  API_URL,
  AUDIO_ID,
  BASE,
  TRANSITIONS,
  error,
  mockState,
  normalize,
  notFound,
  takeFailure,
} from './curriculum-mock';

/**
 * Taxonomia, banco de questões e itens problemáticos simulados, com estado
 * (lê o mesmo `mockState` do conteúdo). Devolve os mesmos códigos de erro
 * da API — `SLUG_IN_USE`, `INVALID_PREREQUISITES`, `MISSING_REFERENCES`,
 * `REGISTER_SKILL_TAKEN`, `ITEM_IS_IMMUTABLE`, `ITEM_IN_USE`,
 * `CONTENT_VALIDATION_FAILED` — e valida o item com o `validateItem` real
 * do `packages/shared`.
 */

type Json = Record<string, unknown>;

const ASSESSMENT = `${API_URL}/admin/assessment`;
const AUDIO_URL = `https://cdn.example.com/${AUDIO_ID}.mp3`;

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

function now(): string {
  mockState.counter += 1;

  return new Date(
    Date.UTC(2026, 11, 1, 12, 0, mockState.counter),
  ).toISOString();
}

/** Paginação por cursor simples: o cursor é o deslocamento. */
function paginate(rows: readonly unknown[], search: URLSearchParams): Response {
  const limit = Number(search.get('limit') ?? 20);
  const offset = Number(search.get('cursor') ?? 0);
  const data = rows.slice(offset, offset + limit);
  const hasMore = offset + limit < rows.length;

  return HttpResponse.json({
    data,
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  });
}

function logList(resource: string, request: Request): URLSearchParams {
  const search = new URL(request.url).searchParams;

  mockState.calls.listQueries.push({ resource, search: search.toString() });

  return search;
}

function logWrite(
  resource: string,
  action: string,
  id?: string,
  body?: Json,
): void {
  mockState.calls.bankWrites.push({
    resource,
    action,
    ...(id === undefined ? {} : { id }),
    ...(body === undefined ? {} : { body }),
  });
}

/** O corpo não passa no schema: 422 com o caminho e a mensagem de cada campo. */
function invalidBody(issues: z.core.$ZodIssue[]): Response {
  return error(
    422,
    'CONTENT_VALIDATION_FAILED',
    'O conteúdo tem problemas que precisam ser corrigidos antes de salvar.',
    {
      issues: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issueMessage(issue),
      })),
    },
  );
}

const includeDeprecated = (search: URLSearchParams): boolean =>
  search.get('includeDeprecated') === 'true';

function byId(rows: Json[], id: string | readonly string[] | undefined) {
  return rows.find((row) => row.id === id);
}

function missing(details: Record<string, unknown>, reason?: string): Response {
  return error(
    422,
    'MISSING_REFERENCES',
    'O conteúdo aponta para coisas que não existem ou não estão publicadas.',
    { ...details, ...(reason === undefined ? {} : { reason }) },
  );
}

/** O substituto existe, não é o próprio e não está obsoleto. */
function badReplacement(
  rows: Json[],
  kind: string,
  id: string,
  replacedById: string | null | undefined,
): Response | null {
  if (replacedById === null || replacedById === undefined) {
    return null;
  }

  if (replacedById === id) {
    return missing({ [kind]: [id] }, 'Não dá para substituir por ele mesmo.');
  }

  const replacement = byId(rows, replacedById);

  if (replacement === undefined) {
    return missing({ [kind]: [replacedById] });
  }

  if (replacement.deprecatedAt !== null) {
    return missing(
      { [kind]: [replacedById] },
      'O substituto já está obsoleto.',
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** Caminho que fecha ciclo ao trocar os pré-requisitos de `skillId`, ou null. */
function prerequisiteCycle(
  skillId: string,
  prerequisites: readonly string[],
): string[] | null {
  const edges = new Map<string, string[]>(
    mockState.skills.map((skill) => [
      String(skill.id),
      skill.prerequisites as string[],
    ]),
  );

  const walk = (
    node: string,
    trail: string[],
    seen: Set<string>,
  ): string[] | null => {
    if (node === skillId) {
      return [...trail, node];
    }

    if (seen.has(node)) {
      return null;
    }

    seen.add(node);

    for (const next of edges.get(node) ?? []) {
      const found = walk(next, [...trail, node], seen);

      if (found !== null) {
        return found;
      }
    }

    return null;
  };

  for (const first of prerequisites) {
    const path = walk(first, [], new Set());

    if (path !== null) {
      return [skillId, ...path];
    }
  }

  return null;
}

function invalidPrerequisites(
  skillId: string,
  prerequisites: readonly string[],
  current: readonly string[],
): Response | null {
  if (prerequisites.includes(skillId)) {
    return error(
      422,
      'INVALID_PREREQUISITES',
      'Uma skill não pode ser pré-requisito de si mesma.',
      { reason: 'SELF', skills: [skillId] },
    );
  }

  const unknown = prerequisites.filter(
    (id) => byId(mockState.skills, id) === undefined,
  );

  if (unknown.length > 0) {
    return missing({ skills: unknown });
  }

  const cycle = prerequisiteCycle(skillId, prerequisites);

  if (cycle !== null) {
    return error(
      422,
      'INVALID_PREREQUISITES',
      'Esses pré-requisitos formam um ciclo: uma skill acabaria exigindo a si mesma.',
      { reason: 'CYCLE', skills: [...new Set(cycle)], cycle },
    );
  }

  const deprecated = prerequisites.filter(
    (id) =>
      !current.includes(id) &&
      byId(mockState.skills, id)?.deprecatedAt !== null,
  );

  if (deprecated.length > 0) {
    return error(
      422,
      'INVALID_PREREQUISITES',
      'Skill obsoleta não pode ser pré-requisito. Use a que a substituiu.',
      { reason: 'DEPRECATED', skills: deprecated },
    );
  }

  return null;
}

function unknownErrorPatterns(ids: readonly string[]): Response | null {
  const unknown = ids.filter(
    (id) => byId(mockState.errorPatterns, id) === undefined,
  );

  return unknown.length === 0 ? null : missing({ errorPatterns: unknown });
}

// ---------------------------------------------------------------------------
// Notas de registro
// ---------------------------------------------------------------------------

function noteWithAudio(row: Json): Json {
  return {
    ...row,
    audio:
      row.audioAssetId === AUDIO_ID
        ? { url: AUDIO_URL, mimeType: 'audio/mpeg', durationMs: 900 }
        : null,
  };
}

function badNoteReferences(
  id: string,
  input: { skillId?: string | null; audioAssetId?: string | null },
): Response | null {
  if (input.skillId !== undefined && input.skillId !== null) {
    const skill = byId(mockState.skills, input.skillId);

    if (skill === undefined) {
      return missing({ skills: [input.skillId] });
    }

    if (skill.type !== 'REGISTER') {
      return missing(
        { skills: [input.skillId] },
        'A skill de uma nota de registro precisa ser do tipo REGISTER.',
      );
    }

    const taken = mockState.registerNotes.find(
      (note) => note.skillId === input.skillId && note.id !== id,
    );

    if (taken !== undefined) {
      return error(
        409,
        'REGISTER_SKILL_TAKEN',
        `A skill "${input.skillId}" já está ligada à nota "${String(taken.id)}". Cada skill serve a uma nota só.`,
        { skillId: input.skillId, noteId: taken.id },
      );
    }
  }

  if (
    input.audioAssetId !== undefined &&
    input.audioAssetId !== null &&
    input.audioAssetId !== AUDIO_ID
  ) {
    return missing(
      { assets: [input.audioAssetId] },
      'O arquivo de áudio da nota não existe ou não é um áudio.',
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

/** Lições no ar que usam o item: versões publicadas com ele na prática. */
function usagesOf(itemId: string): Json[] {
  return mockState.versions
    .filter((version) => version.status === 'PUBLISHED')
    .filter((version) =>
      version.steps.some((step) => {
        const ids = (step.content as Json | null)?.itemIds;

        return Array.isArray(ids) && ids.includes(itemId);
      }),
    )
    .map((version) => {
      const lesson = mockState.lessons.find((l) => l.id === version.lessonId);

      return {
        lessonId: version.lessonId,
        lessonSlug: lesson?.slug ?? '',
        versionId: version.id,
        version: version.version,
        status: version.status,
        title: version.title,
      };
    });
}

function itemDetail(row: Json): Json {
  const content = (row.content ?? {}) as Json;

  return {
    ...row,
    audioUrl: content.audioAssetId === AUDIO_ID ? AUDIO_URL : null,
    usedIn: usagesOf(String(row.id)),
  };
}

type ItemBody = {
  type: string;
  prompt: string;
  content: unknown;
  acceptedAnswers?: string[];
  explanation: string;
  errorPatternMap?: Record<string, string>;
  cefrLevel: CefrLevel;
  skillIds: string[];
};

/** O que a API confere em `assertValid`: regras do item e referências. */
function badItem(item: ItemBody): Response | null {
  const issues = validateItem({
    type: item.type as never,
    content: item.content,
    acceptedAnswers: item.acceptedAnswers ?? [],
    ...(item.errorPatternMap === undefined
      ? {}
      : { errorPatternMap: item.errorPatternMap }),
  });

  if (issues.length > 0) {
    return error(
      422,
      'CONTENT_VALIDATION_FAILED',
      'O conteúdo tem problemas que precisam ser corrigidos antes de salvar.',
      { issues },
    );
  }

  const unknownSkills = item.skillIds.filter(
    (id) => byId(mockState.skills, id) === undefined,
  );

  if (unknownSkills.length > 0) {
    return missing({ skills: unknownSkills });
  }

  const unknownPatterns = unknownErrorPatterns(
    Object.values(item.errorPatternMap ?? {}),
  );

  if (unknownPatterns !== null) {
    return unknownPatterns;
  }

  const content = (item.content ?? {}) as Json;

  if (
    item.type === 'REGISTER_SWAP' &&
    byId(mockState.registerNotes, content.registerNoteId as string) ===
      undefined
  ) {
    return missing({ registerNotes: [content.registerNoteId] });
  }

  if (
    typeof content.audioAssetId === 'string' &&
    content.audioAssetId !== AUDIO_ID
  ) {
    return missing(
      { assets: [content.audioAssetId] },
      'O áudio da questão não existe ou não é um áudio.',
    );
  }

  return null;
}

function itemSummary(row: Json): Json {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    cefrLevel: row.cefrLevel,
    status: row.status,
    source: row.source,
    difficulty: row.difficulty,
    discrimination: row.discrimination,
    exposureCount: row.exposureCount,
    correctRate: row.correctRate,
    skillIds: row.skillIds,
  };
}

const itemRoute = `${BASE}/items`;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const bankHandlers = [
  // --- Skills ---

  http.get(`${BASE}/skills`, ({ request }) => {
    const search = logList('skills', request);
    const q = search.get('q');
    const terms = q === null ? [] : normalize(q).split(/\s+/).filter(Boolean);

    mockState.calls.skillQueries.push(q ?? '');

    const failure = takeFailure('skills');

    if (failure) {
      return failure;
    }

    const rows = mockState.skills.filter((candidate) => {
      const haystack = normalize(
        `${String(candidate.id)} ${String(candidate.title)}`,
      );

      return (
        (includeDeprecated(search) || candidate.deprecatedAt === null) &&
        (search.get('level') === null ||
          candidate.cefrLevel === search.get('level')) &&
        (search.get('competency') === null ||
          candidate.competency === search.get('competency')) &&
        (search.get('type') === null ||
          candidate.type === search.get('type')) &&
        terms.every((term) => haystack.includes(term))
      );
    });

    return paginate(rows, search);
  }),

  http.get(`${BASE}/skills/:id`, ({ params }) => {
    const found = byId(mockState.skills, params.id);

    return found === undefined ? notFound() : HttpResponse.json(found);
  }),

  http.post(`${BASE}/skills`, async ({ request }) => {
    const failure = takeFailure('save-skill');

    if (failure) {
      return failure;
    }

    const parsed = skillAuthoringSchema.safeParse(await request.json());

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    const input = parsed.data;

    logWrite('skill', 'create', input.id, input as Json);

    if (byId(mockState.skills, input.id) !== undefined) {
      return error(
        409,
        'SLUG_IN_USE',
        `Já existe conteúdo com o identificador "${input.id}".`,
        { slug: input.id },
      );
    }

    const prerequisites = input.prerequisites ?? [];
    const problem =
      invalidPrerequisites(input.id, prerequisites, []) ??
      unknownErrorPatterns(input.commonErrors ?? []);

    if (problem !== null) {
      return problem;
    }

    const created: Json = {
      id: input.id,
      type: input.type,
      competency: input.competency,
      cefrLevel: input.cefrLevel,
      title: input.title,
      description: input.description ?? null,
      prerequisites,
      commonErrors: input.commonErrors ?? [],
      goals: input.goals ?? [],
      deprecatedAt: null,
      replacedById: null,
      createdAt: now(),
      updatedAt: now(),
    };

    mockState.skills.push(created);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(`${BASE}/skills/:id`, async ({ params, request }) => {
    const failure = takeFailure('save-skill');

    if (failure) {
      return failure;
    }

    const current = byId(mockState.skills, params.id);

    if (current === undefined) {
      return notFound();
    }

    const parsed = skillAuthoringPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    logWrite('skill', 'update', String(current.id), parsed.data as Json);

    if (parsed.data.prerequisites !== undefined) {
      const problem = invalidPrerequisites(
        String(current.id),
        parsed.data.prerequisites,
        current.prerequisites as string[],
      );

      if (problem !== null) {
        return problem;
      }
    }

    if (parsed.data.commonErrors !== undefined) {
      const problem = unknownErrorPatterns(parsed.data.commonErrors);

      if (problem !== null) {
        return problem;
      }
    }

    Object.assign(current, parsed.data, { updatedAt: now() });

    return HttpResponse.json(current);
  }),

  http.post(`${BASE}/skills/:id/deprecate`, async ({ params, request }) => {
    const failure = takeFailure('deprecate-skill');

    if (failure) {
      return failure;
    }

    const current = byId(mockState.skills, params.id);

    if (current === undefined) {
      return notFound();
    }

    const body = (await request.json()) as { replacedById?: string | null };

    logWrite('skill', 'deprecate', String(current.id), body);

    const problem = badReplacement(
      mockState.skills,
      'skills',
      String(current.id),
      body.replacedById,
    );

    if (problem !== null) {
      return problem;
    }

    current.deprecatedAt = now();
    current.replacedById = body.replacedById ?? null;

    return HttpResponse.json(current, { status: 201 });
  }),

  // --- Erros típicos ---

  http.get(`${BASE}/error-patterns`, ({ request }) => {
    const search = logList('error-patterns', request);
    const terms = normalize(search.get('q') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const rows = mockState.errorPatterns.filter((pattern) => {
      const haystack = normalize(
        [pattern.id, pattern.description, pattern.example, pattern.correction]
          .map(String)
          .join(' '),
      );

      return (
        (includeDeprecated(search) || pattern.deprecatedAt === null) &&
        (search.get('skillId') === null ||
          (pattern.skillIds as string[]).includes(
            search.get('skillId') ?? '',
          )) &&
        terms.every((term) => haystack.includes(term))
      );
    });

    return paginate(rows, search);
  }),

  http.post(`${BASE}/error-patterns`, async ({ request }) => {
    const failure = takeFailure('save-error-pattern');

    if (failure) {
      return failure;
    }

    const parsed = errorPatternAuthoringSchema.safeParse(await request.json());

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    const input = parsed.data;

    logWrite('error-pattern', 'create', input.id, input as Json);

    if (byId(mockState.errorPatterns, input.id) !== undefined) {
      return error(
        409,
        'SLUG_IN_USE',
        `Já existe conteúdo com o identificador "${input.id}".`,
        { slug: input.id },
      );
    }

    const unknown = (input.skillIds ?? []).filter(
      (id) => byId(mockState.skills, id) === undefined,
    );

    if (unknown.length > 0) {
      return missing({ skills: unknown });
    }

    const created: Json = {
      id: input.id,
      description: input.description,
      example: input.example,
      correction: input.correction,
      explanation: input.explanation,
      skillIds: input.skillIds ?? [],
      deprecatedAt: null,
      replacedById: null,
    };

    mockState.errorPatterns.push(created);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(`${BASE}/error-patterns/:id`, async ({ params, request }) => {
    const failure = takeFailure('save-error-pattern');

    if (failure) {
      return failure;
    }

    const current = byId(mockState.errorPatterns, params.id);

    if (current === undefined) {
      return notFound();
    }

    const parsed = errorPatternAuthoringPatchSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    logWrite(
      'error-pattern',
      'update',
      String(current.id),
      parsed.data as Json,
    );

    const unknown = (parsed.data.skillIds ?? []).filter(
      (id) => byId(mockState.skills, id) === undefined,
    );

    if (unknown.length > 0) {
      return missing({ skills: unknown });
    }

    Object.assign(current, parsed.data);

    return HttpResponse.json(current);
  }),

  http.post(
    `${BASE}/error-patterns/:id/deprecate`,
    async ({ params, request }) => {
      const current = byId(mockState.errorPatterns, params.id);

      if (current === undefined) {
        return notFound();
      }

      const body = (await request.json()) as { replacedById?: string | null };

      logWrite('error-pattern', 'deprecate', String(current.id), body);

      const problem = badReplacement(
        mockState.errorPatterns,
        'errorPatterns',
        String(current.id),
        body.replacedById,
      );

      if (problem !== null) {
        return problem;
      }

      current.deprecatedAt = now();
      current.replacedById = body.replacedById ?? null;

      return HttpResponse.json(current, { status: 201 });
    },
  ),

  // --- Notas de registro ---

  http.get(`${BASE}/register-notes`, ({ request }) => {
    const search = logList('register-notes', request);
    const terms = normalize(search.get('q') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const rows = mockState.registerNotes
      .filter((note) => {
        const haystack = normalize(
          [note.id, note.spokenForm, note.standardForm].map(String).join(' '),
        );

        return (
          (includeDeprecated(search) || note.deprecatedAt === null) &&
          (search.get('level') === null ||
            note.cefrLevel === search.get('level')) &&
          (search.get('register') === null ||
            note.register === search.get('register')) &&
          (search.get('skillId') === null ||
            note.skillId === search.get('skillId')) &&
          terms.every((term) => haystack.includes(term))
        );
      })
      .map(noteWithAudio);

    return paginate(rows, search);
  }),

  http.post(`${BASE}/register-notes`, async ({ request }) => {
    const failure = takeFailure('save-register-note');

    if (failure) {
      return failure;
    }

    const parsed = registerNoteAuthoringSchema.safeParse(await request.json());

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    const input = parsed.data;

    logWrite('register-note', 'create', input.id, input as Json);

    if (byId(mockState.registerNotes, input.id) !== undefined) {
      return error(
        409,
        'SLUG_IN_USE',
        `Já existe conteúdo com o identificador "${input.id}".`,
        { slug: input.id },
      );
    }

    const problem = badNoteReferences(input.id, input);

    if (problem !== null) {
      return problem;
    }

    const created: Json = {
      id: input.id,
      spokenForm: input.spokenForm,
      standardForm: input.standardForm,
      register: input.register,
      explanation: input.explanation,
      whenToAvoid: input.whenToAvoid ?? null,
      cefrLevel: input.cefrLevel,
      skillId: input.skillId ?? null,
      audioAssetId: input.audioAssetId ?? null,
      deprecatedAt: null,
      replacedById: null,
      createdAt: now(),
      updatedAt: now(),
    };

    mockState.registerNotes.push(created);

    return HttpResponse.json(noteWithAudio(created), { status: 201 });
  }),

  http.patch(`${BASE}/register-notes/:id`, async ({ params, request }) => {
    const failure = takeFailure('save-register-note');

    if (failure) {
      return failure;
    }

    const current = byId(mockState.registerNotes, params.id);

    if (current === undefined) {
      return notFound();
    }

    const parsed = registerNoteAuthoringPatchSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    logWrite(
      'register-note',
      'update',
      String(current.id),
      parsed.data as Json,
    );

    const problem = badNoteReferences(String(current.id), parsed.data);

    if (problem !== null) {
      return problem;
    }

    Object.assign(current, parsed.data, { updatedAt: now() });

    return HttpResponse.json(noteWithAudio(current));
  }),

  http.post(
    `${BASE}/register-notes/:id/deprecate`,
    async ({ params, request }) => {
      const current = byId(mockState.registerNotes, params.id);

      if (current === undefined) {
        return notFound();
      }

      const body = (await request.json()) as { replacedById?: string | null };

      logWrite('register-note', 'deprecate', String(current.id), body);

      const problem = badReplacement(
        mockState.registerNotes,
        'registerNotes',
        String(current.id),
        body.replacedById,
      );

      if (problem !== null) {
        return problem;
      }

      current.deprecatedAt = now();
      current.replacedById = body.replacedById ?? null;

      return HttpResponse.json(noteWithAudio(current), { status: 201 });
    },
  ),

  // --- Itens ---

  http.get(itemRoute, ({ request }) => {
    const search = logList('items', request);

    mockState.calls.itemQueries.push(search.toString());

    const failure = takeFailure('items-list');

    if (failure) {
      return failure;
    }

    const terms = normalize(search.get('q') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const rows = mockState.items
      .filter((candidate) => {
        const haystack = normalize(
          `${String(candidate.prompt)} ${String(candidate.slug ?? '')}`,
        );

        return (
          (search.get('status') === null ||
            candidate.status === search.get('status')) &&
          (search.get('level') === null ||
            candidate.cefrLevel === search.get('level')) &&
          (search.get('type') === null ||
            candidate.type === search.get('type')) &&
          (search.get('source') === null ||
            candidate.source === search.get('source')) &&
          (search.get('skillId') === null ||
            (candidate.skillIds as string[]).includes(
              search.get('skillId') ?? '',
            )) &&
          terms.every((term) => haystack.includes(term))
        );
      })
      // Mais novo primeiro; o id desempata.
      .sort(
        (a, b) =>
          String(b.createdAt).localeCompare(String(a.createdAt)) ||
          String(a.id).localeCompare(String(b.id)),
      );

    return paginate(rows, search);
  }),

  http.get(`${itemRoute}/:id`, ({ params }) => {
    const found = byId(mockState.items, params.id);

    return found === undefined
      ? notFound()
      : HttpResponse.json(itemDetail(found));
  }),

  http.post(itemRoute, async ({ request }) => {
    const failure = takeFailure('create-item');

    if (failure) {
      return failure;
    }

    const parsed = itemAuthoringSchema.safeParse(await request.json());

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    const input = parsed.data;

    logWrite('item', 'create', undefined, input as Json);

    const problem = badItem(input as ItemBody);

    if (problem !== null) {
      return problem;
    }

    const created: Json = {
      id: crypto.randomUUID(),
      slug: input.slug ?? null,
      type: input.type,
      prompt: input.prompt,
      content: input.content,
      acceptedAnswers: input.acceptedAnswers ?? [],
      explanation: input.explanation,
      errorPatternMap: input.errorPatternMap ?? {},
      cefrLevel: input.cefrLevel,
      difficulty:
        input.difficulty ?? INITIAL_DIFFICULTY_BY_LEVEL[input.cefrLevel],
      discrimination: input.discrimination ?? 1,
      exposureCount: 0,
      correctRate: null,
      status: 'DRAFT',
      source: input.source ?? 'HUMAN',
      replacedById: null,
      replaces: null,
      createdAt: now(),
      updatedAt: now(),
      skillIds: input.skillIds,
    };

    mockState.items.push(created);

    return HttpResponse.json(itemDetail(created), { status: 201 });
  }),

  http.patch(`${itemRoute}/:id`, async ({ params, request }) => {
    const failure = takeFailure('save-item');

    if (failure) {
      return failure;
    }

    const current = byId(mockState.items, params.id);

    if (current === undefined) {
      return notFound();
    }

    const parsed = itemAuthoringPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    const input = parsed.data;

    logWrite('item', 'update', String(current.id), input as Json);

    const changes = immutableFieldChanges(
      {
        type: current.type as never,
        prompt: String(current.prompt),
        content: current.content,
        acceptedAnswers: current.acceptedAnswers as string[],
      },
      {
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.prompt === undefined ? {} : { prompt: input.prompt }),
        ...(input.content === undefined ? {} : { content: input.content }),
        ...(input.acceptedAnswers === undefined
          ? {}
          : { acceptedAnswers: input.acceptedAnswers }),
      },
    );

    if (requiresNewItem(current.status as ContentStatus, changes)) {
      return error(
        409,
        'ITEM_IS_IMMUTABLE',
        'Este item já foi publicado. Para mudar o enunciado, crie uma nova versão dele.',
        { fields: changes },
      );
    }

    const merged = { ...current, ...input } as unknown as ItemBody;
    const problem = badItem(merged);

    if (problem !== null) {
      return problem;
    }

    Object.assign(current, input, {
      ...(input.difficulty === null
        ? {
            difficulty: INITIAL_DIFFICULTY_BY_LEVEL[merged.cefrLevel],
          }
        : {}),
      // Editar derruba a revisão: o que foi revisado deixou de ser o que está aí.
      ...(current.status === 'IN_REVIEW' || current.status === 'APPROVED'
        ? { status: 'DRAFT' }
        : {}),
      updatedAt: now(),
    });

    return HttpResponse.json(itemDetail(current));
  }),

  http.post(`${itemRoute}/:id/revisions`, async ({ params, request }) => {
    const failure = takeFailure('create-item-revision');

    if (failure) {
      return failure;
    }

    const current = byId(mockState.items, params.id);

    if (current === undefined) {
      return notFound();
    }

    const parsed = itemAuthoringPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return invalidBody(parsed.error.issues);
    }

    logWrite('item', 'revision', String(current.id), parsed.data as Json);

    if (current.replacedById !== null) {
      return error(
        409,
        'INVALID_CONTENT_TRANSITION',
        'Já existe uma nova versão deste item.',
        { current: 'já substituído', action: 'criar outra revisão de' },
      );
    }

    const next = { ...current, ...parsed.data } as unknown as ItemBody;
    const problem = badItem(next);

    if (problem !== null) {
      return problem;
    }

    const revision: Json = {
      ...current,
      ...parsed.data,
      id: crypto.randomUUID(),
      slug: null,
      status: 'DRAFT',
      exposureCount: 0,
      correctRate: null,
      replacedById: null,
      replaces: current.id,
      createdAt: now(),
      updatedAt: now(),
    };

    mockState.items.push(revision);
    current.replacedById = revision.id;

    return HttpResponse.json(itemDetail(revision), { status: 201 });
  }),

  http.post(`${itemRoute}/:id/:action`, ({ params }) => {
    const action = String(params.action);
    const failure = takeFailure(`item-action:${action}`);

    if (failure) {
      return failure;
    }

    const current = byId(mockState.items, params.id);

    if (current === undefined) {
      return notFound();
    }

    logWrite('item', action, String(current.id));

    const target = TRANSITIONS[action]?.[current.status as ContentStatus];

    if (target === undefined) {
      return error(
        409,
        'INVALID_CONTENT_TRANSITION',
        'Não dá para fazer isso com um conteúdo neste estado.',
        { current: current.status, action },
      );
    }

    if (target === 'ARCHIVED') {
      const uses = usagesOf(String(current.id));

      if (uses.length > 0) {
        return error(
          409,
          'ITEM_IN_USE',
          'Este item está sendo usado por uma lição publicada e não pode ser arquivado.',
          { lessons: [...new Set(uses.map((use) => use.lessonSlug))] },
        );
      }
    }

    current.status = target;
    current.updatedAt = now();

    for (const other of mockState.items) {
      // Publicar a revisão aposenta o item que ela substitui.
      if (
        target === 'PUBLISHED' &&
        other.replacedById === current.id &&
        other.status === 'PUBLISHED'
      ) {
        other.status = 'ARCHIVED';
      }

      // Arquivar uma revisão que nunca foi ao ar solta o original.
      if (
        target === 'ARCHIVED' &&
        other.replacedById === current.id &&
        other.status !== 'ARCHIVED'
      ) {
        other.replacedById = null;
      }
    }

    return HttpResponse.json(itemDetail(current), { status: 201 });
  }),

  // --- Itens problemáticos e estatísticas (módulo 8) ---

  http.get(`${ASSESSMENT}/flagged-items`, ({ request }) => {
    const search = logList('flagged', request);
    const open = mockState.calibrations.filter(
      (row) => row.resolvedAt === null && row.flags.length > 0,
    );
    const latest = new Map<string, (typeof open)[number]>();

    for (const row of open) {
      const seen = latest.get(row.itemId);

      if (seen === undefined || row.calibratedAt >= seen.calibratedAt) {
        latest.set(row.itemId, row);
      }
    }

    const rows = [...latest.values()]
      .sort(
        (a, b) =>
          b.calibratedAt.localeCompare(a.calibratedAt) ||
          a.itemId.localeCompare(b.itemId),
      )
      .flatMap((row) => {
        const item = byId(mockState.items, row.itemId);

        if (
          item === undefined ||
          (search.get('flag') !== null &&
            !row.flags.includes(search.get('flag') ?? '')) ||
          (search.get('level') !== null &&
            item.cefrLevel !== search.get('level')) ||
          (search.get('type') !== null && item.type !== search.get('type'))
        ) {
          return [];
        }

        return [
          {
            item: itemSummary(item),
            flags: row.flags,
            pValue: row.pValue,
            pointBiserial: row.pointBiserial,
            responses: row.responses,
            previousDifficulty: row.previousDifficulty,
            appliedDifficulty: row.appliedDifficulty,
            calibratedAt: row.calibratedAt,
          },
        ];
      });

    return paginate(rows, search);
  }),

  http.get(`${ASSESSMENT}/items/:itemId/stats`, ({ params }) => {
    const failure = takeFailure('item-stats');

    if (failure) {
      return failure;
    }

    const item = byId(mockState.items, params.itemId);

    if (item === undefined) {
      return notFound();
    }

    const history = mockState.calibrations
      .filter((row) => row.itemId === item.id)
      .sort((a, b) => a.calibratedAt.localeCompare(b.calibratedAt));
    const open = history.filter(
      (row) => row.resolvedAt === null && row.flags.length > 0,
    );

    return HttpResponse.json({
      itemId: item.id,
      exposureCount: item.exposureCount,
      correctRate: item.correctRate,
      difficulty: item.difficulty,
      initialDifficulty: history[0]?.previousDifficulty ?? item.difficulty,
      discrimination: item.discrimination,
      flags: open.at(-1)?.flags ?? [],
      lastCalibratedAt: history.at(-1)?.calibratedAt ?? null,
      history: history.map(({ itemId: _itemId, ...row }) => row),
    });
  }),

  http.post(`${ASSESSMENT}/flagged-items/:itemId/resolve`, ({ params }) => {
    const failure = takeFailure('resolve-flagged');

    if (failure) {
      return failure;
    }

    const itemId = String(params.itemId);
    const open = mockState.calibrations.filter(
      (row) =>
        row.itemId === itemId &&
        row.resolvedAt === null &&
        row.flags.length > 0,
    );

    for (const row of open) {
      row.resolvedAt = now();
    }

    mockState.calls.resolvedFlags.push(itemId);

    return HttpResponse.json({ resolved: open.length });
  }),
];
