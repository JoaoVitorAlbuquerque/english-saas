import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../http/api-error';
import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  getPreview,
  reorderLessons,
  reorderUnits,
  saveDraftSteps,
  transitionVersion,
  uploadImage,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const versionFixture = {
  id: 'v1',
  version: 1,
  status: 'DRAFT',
  title: 'Nice to meet you',
  objective: 'Se apresentar.',
  cefrLevel: 'A1',
  estimatedMinutes: 10,
  approvedAt: null,
  approvedById: null,
  publishedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  lesson: { id: 'l1', slug: 'nice-to-meet-you', order: 0, unitId: 'u1' },
  steps: [{ id: 's1', order: 0, type: 'SCENE', content: { location: 'x' } }],
  targetSkills: [{ skillId: 'grammar.be.present', position: 0 }],
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('saveDraftSteps', () => {
  it('grava como está, com ?draft=true, e devolve os problemas do servidor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...versionFixture,
        issues: [{ order: 0, path: 'lines', message: 'Pouca fala.' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await saveDraftSteps('v1', {
      steps: [{ order: 0, type: 'SCENE', content: { location: 'x' } }],
    });

    expect(result.issues).toEqual([
      { order: 0, path: 'lines', message: 'Pouca fala.' },
    ]);
    expect(result.steps[0]?.content).toEqual({ location: 'x' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/admin/curriculum/lesson-versions/v1/steps?draft=true',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          steps: [{ order: 0, type: 'SCENE', content: { location: 'x' } }],
        }),
      }),
    );
  });

  it('não deixa passar etapa com tipo que não existe', async () => {
    vi.stubGlobal('fetch', vi.fn());

    await expect(
      saveDraftSteps('v1', {
        steps: [{ order: 0, type: 'QUIZ' as 'SCENE', content: {} }],
      }),
    ).rejects.toThrow();
  });

  it('propaga o erro da API com código e detalhes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'INVALID_CONTENT_TRANSITION',
              message: 'Não dá para editar um conteúdo publicado.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    const error = await saveDraftSteps('v1', { steps: [] }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('INVALID_CONTENT_TRANSITION');
  });
});

describe('transitionVersion', () => {
  it('chama a rota da ação', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ ...versionFixture, status: 'PUBLISHED' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const version = await transitionVersion('v1', 'publish');

    expect(version.status).toBe('PUBLISHED');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/admin/curriculum/lesson-versions/v1/publish',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('reordenar', () => {
  it('unidades: manda o nível e a lista inteira na ordem nova', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await reorderUnits('level-1', ['b', 'a']);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/admin/curriculum/units/reorder',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ levelId: 'level-1', ids: ['b', 'a'] }),
      }),
    );
  });

  it('lições: manda a unidade e a lista', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await reorderLessons('unit-1', ['x', 'y', 'z']);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/admin/curriculum/lessons/reorder',
      expect.objectContaining({
        body: JSON.stringify({ unitId: 'unit-1', ids: ['x', 'y', 'z'] }),
      }),
    );
  });

  it('recusa lista vazia antes de chamar a API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(reorderLessons('unit-1', [])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('uploadImage', () => {
  it('manda multipart sem Content-Type de JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'asset-1',
        kind: 'IMAGE',
        mimeType: 'image/png',
        storageKey: 'content/images/abc.png',
        url: 'https://cdn/abc.png',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = new File([new Uint8Array([1, 2, 3])], 'maya.png', {
      type: 'image/png',
    });
    const asset = await uploadImage(file);

    expect(asset.url).toBe('https://cdn/abc.png');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers).toHaveProperty('Authorization', 'Bearer token-123');
  });
});

describe('getPreview', () => {
  it('aceita etapa incompleta: o preview mostra o aviso daquela etapa', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'l1',
          slug: 'nice-to-meet-you',
          order: 0,
          version: 1,
          title: 'Nice to meet you',
          objective: 'Se apresentar.',
          cefrLevel: 'A1',
          estimatedMinutes: 10,
          publishedAt: null,
          unit: { id: 'u1', slug: 'a1-u1', title: 'Episódio 1', order: 0 },
          level: { cefrLevel: 'A1', title: 'A1' },
          targetSkills: [],
          characters: [],
          registerNotes: [],
          items: [],
          steps: [{ order: 0, type: 'SCENE', content: { location: 'x' } }],
          assets: {},
        }),
      ),
    );

    const preview = await getPreview('v1');

    expect(preview.steps[0]?.content).toEqual({ location: 'x' });
  });
});
