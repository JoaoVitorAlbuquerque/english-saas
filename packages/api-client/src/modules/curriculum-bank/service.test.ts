import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../http/api-error';
import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  createItem,
  createItemRevision,
  createRegisterNote,
  createSkill,
  deprecateErrorPattern,
  deprecateRegisterNote,
  deprecateSkill,
  getItem,
  getItemStats,
  listErrorPatterns,
  listFlaggedItems,
  listItems,
  listRegisterNotes,
  listSkills,
  resolveFlaggedItem,
  transitionItem,
  updateItem,
  updateSkill,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const emptyPage = { data: [], nextCursor: null, hasMore: false };

const skillFixture = {
  id: 'grammar.be.present',
  type: 'GRAMMAR',
  competency: 'GRAMMAR',
  cefrLevel: 'A1',
  title: 'Verbo to be',
  description: null,
  prerequisites: [],
  commonErrors: [],
  goals: [],
  deprecatedAt: null,
  replacedById: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const itemFixture = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: null,
  type: 'MULTIPLE_CHOICE',
  prompt: 'I ___ Maya.',
  content: { options: [{ id: 'a', text: 'am' }], correctOptionIds: ['a'] },
  acceptedAnswers: [],
  explanation: 'Com "I", o verbo é "am".',
  errorPatternMap: {},
  cefrLevel: 'A1',
  skillIds: ['grammar.be.present'],
  status: 'DRAFT',
  source: 'HUMAN',
  difficulty: -2,
  discrimination: 1,
  exposureCount: 0,
  correctRate: null,
  replacedById: null,
  replaces: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  audioUrl: null,
  usedIn: [],
};

/** Uma `Response` nova a cada chamada: o corpo só se lê uma vez. */
function stubFetch(body: unknown, init?: ResponseInit) {
  const fetchMock = vi
    .fn()
    .mockImplementation(() => Promise.resolve(jsonResponse(body, init)));

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];

  return {
    url,
    method: init.method,
    body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('listas de taxonomia', () => {
  it('skills: filtros na query, e ignora o que vier vazio', async () => {
    const fetchMock = stubFetch({ ...emptyPage, data: [skillFixture] });

    const page = await listSkills({
      q: 'verbo to be',
      level: 'A1',
      competency: 'GRAMMAR',
      type: 'GRAMMAR',
      limit: 30,
    });

    expect(page.data[0]?.title).toBe('Verbo to be');
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/curriculum/skills?q=verbo+to+be&level=A1&competency=GRAMMAR&type=GRAMMAR&limit=30',
    );

    await listSkills({ q: '' });

    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/curriculum/skills',
    );
  });

  it('includeDeprecated=false vai para a query: é um valor, não ausência', async () => {
    const fetchMock = stubFetch(emptyPage);

    await listSkills({ includeDeprecated: false });
    expect(lastRequest(fetchMock).url).toContain('includeDeprecated=false');

    await listErrorPatterns({ includeDeprecated: true, skillId: 'grammar.x' });
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/curriculum/error-patterns?includeDeprecated=true&skillId=grammar.x',
    );

    await listRegisterNotes({ level: 'A2', register: 'NEUTRAL', q: 'gonna' });
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/curriculum/register-notes?level=A2&register=NEUTRAL&q=gonna',
    );
  });

  it('nota de registro: aceita a URL do áudio, ou nenhum áudio', async () => {
    const note = {
      id: 'gonna',
      spokenForm: 'gonna',
      standardForm: 'going to',
      register: 'INFORMAL_SPOKEN',
      explanation: 'Forma falada.',
      whenToAvoid: null,
      cefrLevel: 'A2',
      skillId: null,
      audioAssetId: '22222222-2222-4222-8222-222222222222',
      audio: {
        url: 'https://cdn/a.mp3',
        mimeType: 'audio/mpeg',
        durationMs: 900,
      },
      deprecatedAt: null,
      replacedById: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    };

    stubFetch({
      ...emptyPage,
      data: [note, { ...note, id: 'wanna', audioAssetId: null, audio: null }],
    });

    const page = await listRegisterNotes();

    expect(page.data[0]?.audio?.url).toBe('https://cdn/a.mp3');
    expect(page.data[1]?.audio).toBeNull();
  });
});

describe('escrita de taxonomia', () => {
  it('cria skill com o corpo validado (slug com ponto é válido)', async () => {
    const fetchMock = stubFetch(skillFixture);

    await createSkill({
      id: 'grammar.be.present',
      type: 'GRAMMAR',
      competency: 'GRAMMAR',
      cefrLevel: 'A1',
      title: 'Verbo to be',
      prerequisites: ['grammar.pronouns'],
    });

    expect(lastRequest(fetchMock)).toMatchObject({
      url: 'http://api.local/admin/curriculum/skills',
      method: 'POST',
      body: { id: 'grammar.be.present', prerequisites: ['grammar.pronouns'] },
    });
  });

  it('recusa antes de chamar a API: slug inválido, título curto', async () => {
    const fetchMock = stubFetch(skillFixture);

    await expect(
      createSkill({
        id: 'Slug Com Espaço',
        type: 'GRAMMAR',
        competency: 'GRAMMAR',
        cefrLevel: 'A1',
        title: 'Verbo to be',
      }),
    ).rejects.toThrow();
    await expect(
      createSkill({
        id: 'grammar.ok',
        type: 'GRAMMAR',
        competency: 'GRAMMAR',
        cefrLevel: 'A1',
        title: 'x',
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('edita por PATCH sem mandar o id (slug não muda)', async () => {
    const fetchMock = stubFetch(skillFixture);

    await updateSkill('grammar.be.present', {
      title: 'Verbo to be (presente)',
    });

    expect(lastRequest(fetchMock)).toEqual({
      url: 'http://api.local/admin/curriculum/skills/grammar.be.present',
      method: 'PATCH',
      body: { title: 'Verbo to be (presente)' },
    });
  });

  it('deprecia com ou sem substituta, nos três tipos', async () => {
    const fetchMock = stubFetch(skillFixture);

    await deprecateSkill('grammar.old', 'grammar.new');
    expect(lastRequest(fetchMock)).toMatchObject({
      url: 'http://api.local/admin/curriculum/skills/grammar.old/deprecate',
      method: 'POST',
      body: { replacedById: 'grammar.new' },
    });

    await deprecateSkill('grammar.old');
    expect(lastRequest(fetchMock).body).toEqual({ replacedById: null });

    stubFetch({
      id: 'l1.a',
      description: 'Descrição aqui.',
      example: 'x',
      correction: 'y',
      explanation: 'Explicação aqui.',
      skillIds: [],
      deprecatedAt: '2026-10-01T10:00:00.000Z',
      replacedById: null,
    });
    await deprecateErrorPattern('l1.a');

    const notesMock = stubFetch({
      id: 'gonna',
      spokenForm: 'gonna',
      standardForm: 'going to',
      register: 'INFORMAL_SPOKEN',
      explanation: 'Forma falada.',
      whenToAvoid: null,
      cefrLevel: 'A2',
      skillId: null,
      audioAssetId: null,
      audio: null,
      deprecatedAt: '2026-10-01T10:00:00.000Z',
      replacedById: 'wanna',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    });

    await deprecateRegisterNote('gonna', 'wanna');
    expect(lastRequest(notesMock).url).toBe(
      'http://api.local/admin/curriculum/register-notes/gonna/deprecate',
    );
  });

  it('cria nota de registro validando o áudio como uuid', async () => {
    const fetchMock = stubFetch({});

    await expect(
      createRegisterNote({
        id: 'gonna',
        spokenForm: 'gonna',
        standardForm: 'going to',
        register: 'INFORMAL_SPOKEN',
        explanation: 'Forma falada.',
        cefrLevel: 'A2',
        audioAssetId: 'nao-e-uuid',
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propaga o código e os detalhes do 422 de pré-requisitos', async () => {
    stubFetch(
      {
        error: {
          code: 'INVALID_PREREQUISITES',
          message: 'Esses pré-requisitos formam um ciclo.',
          details: {
            reason: 'CYCLE',
            cycle: ['grammar.a', 'grammar.b', 'grammar.a'],
          },
        },
      },
      { status: 422 },
    );

    const error = await updateSkill('grammar.a', {
      prerequisites: ['grammar.b'],
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('INVALID_PREREQUISITES');
    expect((error as ApiError).details).toEqual({
      reason: 'CYCLE',
      cycle: ['grammar.a', 'grammar.b', 'grammar.a'],
    });
  });
});

describe('banco de questões', () => {
  it('lista com todos os filtros, na ordem em que o serviço os monta', async () => {
    const fetchMock = stubFetch(emptyPage);

    await listItems({
      status: 'PUBLISHED',
      level: 'A1',
      skillId: 'grammar.be.present',
      type: 'MATCH',
      source: 'AI_DRAFT_REVIEWED',
      q: 'café',
      limit: 30,
    });

    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/curriculum/items?status=PUBLISHED&level=A1&skillId=grammar.be.present&type=MATCH&source=AI_DRAFT_REVIEWED&q=caf%C3%A9&limit=30',
    );
  });

  it('a ficha traz o áudio e as lições que usam o item', async () => {
    stubFetch({
      ...itemFixture,
      audioUrl: 'https://cdn/a.mp3',
      usedIn: [
        {
          lessonId: 'l1',
          lessonSlug: 'nice-to-meet-you',
          versionId: 'v1',
          version: 2,
          status: 'PUBLISHED',
          title: 'Nice to meet you',
        },
      ],
    });

    const item = await getItem(itemFixture.id);

    expect(item.audioUrl).toBe('https://cdn/a.mp3');
    expect(item.usedIn[0]?.lessonSlug).toBe('nice-to-meet-you');
  });

  it('cria item validando limites antes de ir ao servidor', async () => {
    const fetchMock = stubFetch(itemFixture);

    await expect(
      createItem({
        type: 'MULTIPLE_CHOICE',
        prompt: 'x',
        content: {},
        explanation: 'Explicação.',
        cefrLevel: 'A1',
        skillIds: ['grammar.be.present'],
      }),
    ).rejects.toThrow();
    await expect(
      createItem({
        type: 'MULTIPLE_CHOICE',
        prompt: 'I ___ Maya.',
        content: {},
        explanation: 'Explicação.',
        cefrLevel: 'A1',
        skillIds: [],
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();

    await createItem({
      type: 'MULTIPLE_CHOICE',
      prompt: 'I ___ Maya.',
      content: itemFixture.content,
      explanation: 'Explicação.',
      cefrLevel: 'A1',
      skillIds: ['grammar.be.present'],
      difficulty: null,
    });

    expect(lastRequest(fetchMock)).toMatchObject({
      url: 'http://api.local/admin/curriculum/items',
      method: 'POST',
      body: { difficulty: null, skillIds: ['grammar.be.present'] },
    });
  });

  it('edita por PATCH, cria revisão e move no fluxo editorial', async () => {
    const fetchMock = stubFetch(itemFixture);

    await updateItem(itemFixture.id, { explanation: 'Explicação melhor.' });
    expect(lastRequest(fetchMock)).toEqual({
      url: `http://api.local/admin/curriculum/items/${itemFixture.id}`,
      method: 'PATCH',
      body: { explanation: 'Explicação melhor.' },
    });

    await createItemRevision(itemFixture.id);
    expect(lastRequest(fetchMock)).toEqual({
      url: `http://api.local/admin/curriculum/items/${itemFixture.id}/revisions`,
      method: 'POST',
      body: {},
    });

    for (const action of [
      'submit-for-review',
      'approve',
      'reject',
      'publish',
      'archive',
    ] as const) {
      await transitionItem(itemFixture.id, action);
      expect(lastRequest(fetchMock).url).toBe(
        `http://api.local/admin/curriculum/items/${itemFixture.id}/${action}`,
      );
    }
  });

  it('propaga ITEM_IS_IMMUTABLE e ITEM_IN_USE com os detalhes', async () => {
    stubFetch(
      {
        error: {
          code: 'ITEM_IS_IMMUTABLE',
          message: 'Este item já foi publicado.',
          details: { fields: ['prompt'] },
        },
      },
      { status: 409 },
    );

    const error = await updateItem(itemFixture.id, { prompt: 'Novo.' }).catch(
      (caught: unknown) => caught,
    );

    expect((error as ApiError).code).toBe('ITEM_IS_IMMUTABLE');
    expect((error as ApiError).details).toEqual({ fields: ['prompt'] });
  });
});

describe('itens problemáticos e estatísticas', () => {
  const summary = {
    id: itemFixture.id,
    type: 'MULTIPLE_CHOICE',
    prompt: 'Fácil demais',
    cefrLevel: 'B1',
    status: 'PUBLISHED',
    source: 'HUMAN',
    difficulty: -0.3,
    discrimination: 1,
    exposureCount: 60,
    correctRate: 0.98,
    skillIds: ['sim.grammar'],
  };

  it('lista a fila com os filtros de marca, nível e tipo', async () => {
    const fetchMock = stubFetch({
      ...emptyPage,
      data: [
        {
          item: summary,
          flags: ['TOO_EASY'],
          pValue: 0.98,
          pointBiserial: null,
          responses: 60,
          previousDifficulty: 0,
          appliedDifficulty: -0.3,
          calibratedAt: '2026-10-05T03:30:00.000Z',
        },
      ],
    });

    const page = await listFlaggedItems({
      flag: 'TOO_EASY',
      level: 'B1',
      type: 'MULTIPLE_CHOICE',
    });

    expect(page.data[0]?.flags).toEqual(['TOO_EASY']);
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/assessment/flagged-items?flag=TOO_EASY&level=B1&type=MULTIPLE_CHOICE',
    );
  });

  it('a ficha traz a dificuldade inicial, o que está marcado e a história', async () => {
    const fetchMock = stubFetch({
      itemId: itemFixture.id,
      exposureCount: 60,
      correctRate: 0.98,
      difficulty: -0.3,
      initialDifficulty: 0,
      discrimination: 1,
      flags: ['TOO_EASY'],
      lastCalibratedAt: '2026-10-05T03:30:00.000Z',
      history: [
        {
          calibratedAt: '2026-10-05T03:30:00.000Z',
          responses: 60,
          pValue: 0.98,
          estimatedDifficulty: -3,
          previousDifficulty: 0,
          appliedDifficulty: -0.3,
          pointBiserial: 0.1,
          flags: ['TOO_EASY', 'LOW_DISCRIMINATION'],
          resolvedAt: null,
        },
      ],
    });

    const stats = await getItemStats(itemFixture.id);

    expect(stats.initialDifficulty).toBe(0);
    expect(stats.history[0]?.flags).toContain('LOW_DISCRIMINATION');
    expect(lastRequest(fetchMock).url).toBe(
      `http://api.local/admin/assessment/items/${itemFixture.id}/stats`,
    );
  });

  it('resolver marca o problema e devolve quantas marcações fechou', async () => {
    const fetchMock = stubFetch({ resolved: 2 });

    expect(await resolveFlaggedItem(itemFixture.id)).toEqual({ resolved: 2 });
    expect(lastRequest(fetchMock)).toMatchObject({
      url: `http://api.local/admin/assessment/flagged-items/${itemFixture.id}/resolve`,
      method: 'POST',
    });
  });
});
