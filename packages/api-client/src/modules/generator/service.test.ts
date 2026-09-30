import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  generateTopic,
  getGenerationJob,
  ingestContent,
  setTermInReview,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const jobFixture = {
  id: 'job-1',
  kind: 'TOPIC',
  status: 'QUEUED',
  message: 'Seu pedido está na fila. Já, já começa.',
  steps: [
    {
      step: 'FETCH_SOURCE',
      status: 'PENDING',
      label: 'Buscando a fonte',
      startedAt: null,
      finishedAt: null,
    },
  ],
  themes: [],
  suggestions: [],
  materialId: null,
  errorCode: null,
  createdAt: new Date().toISOString(),
  completedAt: null,
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('generator service', () => {
  it('pede material por sugestão e devolve o job na fila', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(jobFixture));
    vi.stubGlobal('fetch', fetchMock);

    const job = await generateTopic({
      suggestionId: 'sug-1',
      clientRequestId: 'req-1',
    });

    expect(job.status).toBe('QUEUED');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.local/generator/topic');
    expect(JSON.parse(init.body as string)).toEqual({
      suggestionId: 'sug-1',
      clientRequestId: 'req-1',
    });
  });

  it('manda texto colado e/ou link no ingest', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...jobFixture, kind: 'INGEST' }));
    vi.stubGlobal('fetch', fetchMock);

    await ingestContent({
      url: 'https://youtu.be/abc123',
      text: 'transcrição colada',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      url: 'https://youtu.be/abc123',
      text: 'transcrição colada',
    });
  });

  it('lê o job pelo id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(jobFixture));
    vi.stubGlobal('fetch', fetchMock);

    await getGenerationJob('job-1');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.local/generator/jobs/job-1',
    );
  });

  it('põe (POST) e tira (DELETE) o termo da revisão, com a chave codificada', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ termKey: 'set sail', inReview: true }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ termKey: 'set sail', inReview: false }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await setTermInReview('mat-1', 'set sail', true);
    const removed = await setTermInReview('mat-1', 'set sail', false);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'http://api.local/me/materials/mat-1/vocabulary/set%20sail/review',
    );
    expect(init.method).toBe('POST');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('DELETE');
    expect(removed.inReview).toBe(false);
  });
});
