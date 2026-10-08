import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../http/api-error';
import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  addComment,
  discardDraft,
  estimateDraft,
  getAudio,
  getMediaJob,
  getQaReport,
  listComments,
  listDrafts,
  listWorkbooks,
  regenerateAudio,
  regenerateWorkbook,
  requestItemsDraft,
  requestLessonDraft,
  requestRegisterNotesDraft,
  resolveComment,
  runQa,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const VERSION = '11111111-1111-4111-8111-111111111111';
const UNIT = '22222222-2222-4222-8222-222222222222';
const CHARACTER = '33333333-3333-4333-8333-333333333333';

const draftFixture = {
  id: '44444444-4444-4444-8444-444444444444',
  kind: 'LESSON',
  status: 'QUEUED',
  params: { objective: 'Se apresentar' },
  promptId: null,
  promptVersion: null,
  model: null,
  costUsdMicros: null,
  lessonVersionId: null,
  createdItemIds: [],
  createdRegisterNoteIds: [],
  errorCode: null,
  generatedAt: null,
  discardedAt: null,
  createdAt: '2026-10-05T10:00:00.000Z',
  requestedBy: { id: 'u1', name: 'Ana' },
  qaReports: [],
};

const reportFixture = {
  id: 'r1',
  warnings: [
    {
      code: 'ORDER_WORDS_TOKENS_MISMATCH',
      severity: 'BLOCKER',
      message: 'As peças não montam a resposta.',
      path: 'items.0',
    },
  ],
  levelStats: {
    totalWords: 120,
    outOfLevelCount: 6,
    ratio: 0.05,
    coverage: 0.8,
    outOfLevel: [{ word: 'ubiquitous', band: 'C1' }],
    wordlistSize: 5000,
  },
  blockerCount: 1,
  warningCount: 0,
  infoCount: 0,
  ranAt: '2026-10-05T10:01:00.000Z',
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

describe('rascunhos', () => {
  it('lista com filtros na query e ignora o que vier vazio', async () => {
    const fetchMock = stubFetch({
      data: [draftFixture],
      nextCursor: null,
      hasMore: false,
    });

    const page = await listDrafts({
      status: 'READY',
      kind: 'ITEMS',
      limit: 30,
    });

    expect(page.data[0]?.requestedBy.name).toBe('Ana');
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/content-studio/drafts?status=READY&kind=ITEMS&limit=30',
    );

    await listDrafts({});

    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/content-studio/drafts',
    );
  });

  it('pede a lição com o corpo do DTO', async () => {
    const fetchMock = stubFetch(draftFixture, { status: 202 });

    await requestLessonDraft({
      unitId: UNIT,
      slug: 'nice-to-meet-you',
      order: 0,
      objective: 'Se apresentar e responder a apresentações.',
      level: 'A1',
      targetSkillIds: ['grammar.be.present'],
      characterIds: [CHARACTER],
    });

    const request = lastRequest(fetchMock);

    expect(request.url).toBe(
      'http://api.local/admin/content-studio/drafts/lesson',
    );
    expect(request.method).toBe('POST');
    expect(request.body).toMatchObject({
      unitId: UNIT,
      level: 'A1',
      targetSkillIds: ['grammar.be.present'],
    });
  });

  it('recusa no cliente o pedido que a API recusaria', async () => {
    const fetchMock = stubFetch(draftFixture);

    await expect(
      requestLessonDraft({
        objective: 'Curto',
        level: 'A1',
        targetSkillIds: [],
        characterIds: [CHARACTER],
      }),
    ).rejects.toThrow();
    // Sem lição nem unidade: o `refine` do pedido também vale.
    await expect(
      requestLessonDraft({
        objective: 'Se apresentar e responder.',
        level: 'A1',
        targetSkillIds: ['grammar.be.present'],
        characterIds: [CHARACTER],
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('questões: os tipos padrão entram quando o pedido não escolhe', async () => {
    const fetchMock = stubFetch({ ...draftFixture, kind: 'ITEMS' });

    await requestItemsDraft({
      skillId: 'grammar.be.present',
      level: 'A1',
      count: 8,
    });

    expect(lastRequest(fetchMock).body).toEqual({
      skillId: 'grammar.be.present',
      level: 'A1',
      count: 8,
      types: ['MULTIPLE_CHOICE', 'FILL_BLANK', 'ORDER_WORDS'],
    });
  });

  it('notas: quantidade e nível; descartar é POST', async () => {
    const fetchMock = stubFetch({ ...draftFixture, kind: 'REGISTER_NOTES' });

    await requestRegisterNotesDraft({ level: 'A2', count: 5 });

    expect(lastRequest(fetchMock).body).toEqual({ level: 'A2', count: 5 });

    await discardDraft(draftFixture.id);

    expect(lastRequest(fetchMock)).toMatchObject({
      url: `http://api.local/admin/content-studio/drafts/${draftFixture.id}/discard`,
      method: 'POST',
    });
  });

  it('estimativa: tipo e quantidade na query; sem histórico vem null', async () => {
    const fetchMock = stubFetch({ usdMicros: null, basedOn: 0 });

    const estimate = await estimateDraft('ITEMS', 6);

    expect(estimate).toEqual({ usdMicros: null, basedOn: 0 });
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/content-studio/drafts/estimate?kind=ITEMS&count=6',
    );
  });
});

describe('revisão automática', () => {
  it('lê o último relatório', async () => {
    const fetchMock = stubFetch(reportFixture);

    const report = await getQaReport(VERSION);

    expect(report?.blockerCount).toBe(1);
    expect(report?.levelStats.outOfLevel?.[0]?.word).toBe('ubiquitous');
    expect(lastRequest(fetchMock).url).toBe(
      `http://api.local/admin/content-studio/qa/lesson-versions/${VERSION}`,
    );
  });

  it('404 quer dizer "ainda não rodou": devolve null, não erro', async () => {
    stubFetch(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'A QA ainda não rodou nesta versão.',
        },
      },
      { status: 404 },
    );

    await expect(getQaReport(VERSION)).resolves.toBeNull();
  });

  it('outro erro continua sendo erro', async () => {
    stubFetch(
      { error: { code: 'FORBIDDEN', message: 'Sem acesso.' } },
      { status: 403 },
    );

    await expect(getQaReport(VERSION)).rejects.toBeInstanceOf(ApiError);
  });

  it('rodar de novo é POST e devolve o relatório novo', async () => {
    const fetchMock = stubFetch({ ...reportFixture, blockerCount: 0 });

    const report = await runQa(VERSION);

    expect(report.blockerCount).toBe(0);
    expect(lastRequest(fetchMock).method).toBe('POST');
  });
});

describe('comentários', () => {
  it('lista só os abertos por padrão e pede os resolvidos quando mandam', async () => {
    const fetchMock = stubFetch([]);

    await listComments(VERSION);

    expect(lastRequest(fetchMock).url).toBe(
      `http://api.local/admin/content-studio/lesson-versions/${VERSION}/comments?includeResolved=false`,
    );

    await listComments(VERSION, true);

    expect(lastRequest(fetchMock).url).toContain('includeResolved=true');
  });

  it('comenta a etapa e marca o problema de áudio com o tipo', async () => {
    const fetchMock = stubFetch({
      id: 'c1',
      target: 'STEP',
      targetRef: '0',
      body: 'Seca demais.',
      audioIssue: null,
      createdAt: '2026-10-05T10:00:00.000Z',
    });

    await addComment(VERSION, {
      target: 'STEP',
      targetRef: '0',
      body: 'Seca demais.',
    });

    expect(lastRequest(fetchMock).body).toEqual({
      target: 'STEP',
      targetRef: '0',
      body: 'Seca demais.',
    });

    await addComment(VERSION, {
      target: 'AUDIO',
      targetRef: 'scene:0:2',
      audioIssue: 'INTONATION',
      body: '',
    });

    expect(lastRequest(fetchMock).body).toEqual({
      target: 'AUDIO',
      targetRef: 'scene:0:2',
      audioIssue: 'INTONATION',
      body: '',
    });
  });

  it('resolver é POST no comentário', async () => {
    const fetchMock = stubFetch({
      id: 'c1',
      resolvedAt: '2026-10-05T11:00:00.000Z',
      resolvedById: 'u1',
    });

    await resolveComment('c1');

    expect(lastRequest(fetchMock)).toMatchObject({
      url: 'http://api.local/admin/content-studio/comments/c1/resolve',
      method: 'POST',
    });
  });
});

describe('áudio, apostilas e jobs', () => {
  it('lê as falas, com a URL e os problemas abertos', async () => {
    stubFetch({
      versionStatus: 'APPROVED',
      total: 1,
      pending: 0,
      targets: [
        {
          key: 'scene:0:0',
          kind: 'SCENE_LINE',
          text: 'Hi!',
          label: 'Maya',
          stepOrder: 0,
          lineIndex: 0,
          itemId: null,
          registerNoteId: null,
          audio: {
            url: 'http://cdn/a.mp3',
            mimeType: 'audio/mpeg',
            durationMs: 900,
          },
          openIssues: [
            {
              id: 'c1',
              audioIssue: 'SPEED',
              body: '',
              createdAt: '2026-10-05T10:00:00.000Z',
            },
          ],
        },
      ],
    });

    const audio = await getAudio(VERSION);

    expect(audio.pending).toBe(0);
    expect(audio.targets[0]?.audio?.url).toBe('http://cdn/a.mp3');
    expect(audio.targets[0]?.openIssues[0]?.audioIssue).toBe('SPEED');
  });

  it('nova geração leva as chaves e a velocidade', async () => {
    const fetchMock = stubFetch({ jobId: '7', queue: 'media' });

    const started = await regenerateAudio(VERSION, {
      keys: ['scene:0:2'],
      speakingRate: 0.8,
    });

    expect(started.jobId).toBe('7');
    expect(lastRequest(fetchMock)).toMatchObject({
      url: `http://api.local/admin/content-studio/lesson-versions/${VERSION}/audio/regenerate`,
      method: 'POST',
      body: { keys: ['scene:0:2'], speakingRate: 0.8 },
    });

    // Velocidade fora do que a API aceita não sai do cliente.
    await expect(
      regenerateAudio(VERSION, { keys: ['scene:0:2'], speakingRate: 3 }),
    ).rejects.toThrow();
    await expect(regenerateAudio(VERSION, { keys: [] })).rejects.toThrow();
  });

  it('apostilas: uma linha por unidade, com e sem PDF', async () => {
    stubFetch([
      {
        unit: { id: UNIT, slug: 'a1-u1', title: 'Episódio 1' },
        cefrLevel: 'A1',
        publishedLessons: 2,
        workbook: {
          id: 'w1',
          status: 'PUBLISHED',
          generatedAt: '2026-10-05T10:00:00.000Z',
          sizeBytes: 20_000,
          url: 'http://cdn/a.pdf',
          stale: true,
        },
      },
      {
        unit: { id: 'u2', slug: 'a1-u2', title: 'Episódio 2' },
        cefrLevel: 'A1',
        publishedLessons: 0,
        workbook: null,
      },
    ]);

    const rows = await listWorkbooks();

    expect(rows[0]?.workbook?.stale).toBe(true);
    expect(rows[1]?.workbook).toBeNull();
  });

  it('regerar a apostila devolve o job, e o job tem estado', async () => {
    const fetchMock = stubFetch({ jobId: '9', queue: 'media' });

    await regenerateWorkbook(UNIT);

    expect(lastRequest(fetchMock)).toMatchObject({
      url: `http://api.local/admin/content-studio/units/${UNIT}/workbook`,
      method: 'POST',
    });

    stubFetch({ id: '9', state: 'active', failedReason: null });

    await expect(getMediaJob('9')).resolves.toEqual({
      id: '9',
      state: 'active',
      failedReason: null,
    });
  });
});
