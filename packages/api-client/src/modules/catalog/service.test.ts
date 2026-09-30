import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  getAllUnits,
  getLevels,
  getUnit,
  getUnits,
  getWorkbookFile,
  getWorkbooks,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const unitFixture = {
  id: 'unit-1',
  slug: 'a1-u1-new-neighbors',
  order: 1,
  title: 'New neighbors',
  synopsis: 'Lucas conhece a nova vizinha.',
  level: { cefrLevel: 'A1', title: 'Iniciante' },
  cover: null,
  cast: [],
  lessons: [
    {
      id: 'lesson-1',
      slug: 'nice-to-meet-you',
      order: 0,
      publishedVersion: {
        version: 1,
        title: 'Nice to meet you',
        objective: 'Se apresentar.',
        cefrLevel: 'A1',
        estimatedMinutes: 15,
      },
      locked: false,
      requiredPlan: null,
    },
  ],
  locked: false,
  requiredPlan: null,
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('getLevels', () => {
  it('busca os níveis do curso', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'level-1',
          cefrLevel: 'A1',
          title: 'Iniciante',
          description: null,
          objectives: ['Se apresentar'],
          order: 0,
          course: { slug: 'ingles', title: 'Inglês', language: 'en' },
          unitCount: 3,
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const levels = await getLevels();

    expect(levels).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/catalog/levels',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getUnits', () => {
  it('pagina unidades por nível', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: [unitFixture], nextCursor: null, hasMore: false }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const page = await getUnits({ level: 'A1', limit: 50 });

    expect(page.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/catalog/units?limit=50&level=A1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getAllUnits', () => {
  it('junta todas as páginas numa lista só', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [unitFixture],
          nextCursor: 'cursor-1',
          hasMore: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ ...unitFixture, id: 'unit-2', slug: 'a1-u2' }],
          nextCursor: null,
          hasMore: false,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const units = await getAllUnits('A1');

    expect(units).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.local/catalog/units?cursor=cursor-1&limit=100&level=A1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getUnit', () => {
  it('busca uma unidade pelo slug, com elenco e lições', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(unitFixture));
    vi.stubGlobal('fetch', fetchMock);

    const unit = await getUnit('a1-u1-new-neighbors');

    expect(unit.lessons[0]).toMatchObject({ slug: 'nice-to-meet-you' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/catalog/units/a1-u1-new-neighbors',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getWorkbooks', () => {
  it('lista apostilas, travadas sem arquivo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'workbook-1',
          slug: 'a1-u1',
          title: 'Apostila — New neighbors',
          description: null,
          order: 0,
          unit: {
            id: 'unit-1',
            slug: 'a1-u1-new-neighbors',
            title: 'New neighbors',
            level: { cefrLevel: 'A1' },
          },
          file: null,
          locked: true,
          requiredPlan: 'BASE',
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const workbooks = await getWorkbooks({ level: 'A1' });

    expect(workbooks[0]).toMatchObject({ locked: true, file: null });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/catalog/workbooks?level=A1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getWorkbookFile', () => {
  it('assina o arquivo da apostila', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'workbook-1',
        file: {
          id: 'asset-1',
          mimeType: 'application/pdf',
          durationMs: null,
          url: 'https://cdn.local/a.pdf',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = await getWorkbookFile('workbook-1');

    expect(file.file.url).toBe('https://cdn.local/a.pdf');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/catalog/workbooks/workbook-1/file',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
