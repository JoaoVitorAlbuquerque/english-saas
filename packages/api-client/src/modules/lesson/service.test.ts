import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  completeAttempt,
  completeStep,
  getLesson,
  startAttempt,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const CHARACTER_ID = 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';

const lessonFixture = {
  id: 'lesson-1',
  slug: 'nice-to-meet-you',
  order: 0,
  version: 1,
  title: 'Nice to meet you',
  objective: 'Se apresentar em inglês.',
  cefrLevel: 'A1',
  estimatedMinutes: 15,
  publishedAt: new Date().toISOString(),
  unit: { id: 'unit-1', slug: 'unit-1', title: 'Primeiros passos', order: 0 },
  level: { cefrLevel: 'A1', title: 'Iniciante' },
  targetSkills: [],
  characters: [
    {
      id: CHARACTER_ID,
      slug: 'lucas',
      name: 'Lucas',
      bio: null,
      avatarAssetId: null,
    },
  ],
  registerNotes: [],
  items: [],
  steps: [
    {
      order: 0,
      type: 'SCENE',
      content: {
        location: 'Corredor do prédio',
        characterIds: [CHARACTER_ID],
        lines: [
          {
            characterId: CHARACTER_ID,
            text: "I'm Lucas.",
            translation: 'Eu sou o Lucas.',
            spans: [],
          },
        ],
      },
    },
  ],
  assets: {},
};

const attemptFixture = {
  id: 'attempt-1',
  lessonId: 'lesson-1',
  lessonVersionId: 'version-1',
  version: 1,
  status: 'IN_PROGRESS',
  source: 'FREE_BROWSE',
  currentStepIndex: 0,
  totalSteps: 1,
  steps: [{ index: 0, type: 'SCENE', completed: false, itemIds: [] }],
  answeredItemIds: [],
  xpEarned: 0,
  startedAt: new Date().toISOString(),
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

describe('getLesson', () => {
  it('busca a lição publicada pelo slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(lessonFixture));
    vi.stubGlobal('fetch', fetchMock);

    const lesson = await getLesson('nice-to-meet-you');

    expect(lesson.steps[0]?.type).toBe('SCENE');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/catalog/lessons/nice-to-meet-you',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('startAttempt', () => {
  it('começa (ou retoma) a tentativa da lição', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...attemptFixture, resumed: false }));
    vi.stubGlobal('fetch', fetchMock);

    const attempt = await startAttempt('lesson-1');

    expect(attempt.resumed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/lessons/lesson-1/attempts',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('completeStep', () => {
  it('conclui a etapa e devolve a tentativa atualizada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...attemptFixture,
        steps: [{ index: 0, type: 'SCENE', completed: true, itemIds: [] }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const attempt = await completeStep('attempt-1', 0, { timeSpentMs: 5_000 });

    expect(attempt.steps[0]?.completed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/attempts/attempt-1/steps/0/complete',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('completeAttempt', () => {
  it('fecha a lição e devolve xp e estatísticas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        attempt: { ...attemptFixture, status: 'COMPLETED' },
        xp: { fromAnswers: 10, completionBonus: 20, total: 30 },
        stats: {
          totalXp: 30,
          currentStreak: 1,
          longestStreak: 1,
          lastStudyDate: '2026-01-01',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await completeAttempt('attempt-1');

    expect(result.xp.total).toBe(30);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/attempts/attempt-1/complete',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
