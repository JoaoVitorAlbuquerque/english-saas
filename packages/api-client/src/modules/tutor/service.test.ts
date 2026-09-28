import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  createCorrection,
  finishRoleplay,
  getCorrection,
  getRoleplay,
  startRoleplay,
  submitRoleplayTurn,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const correctionFixture = {
  id: 'correction-1',
  status: 'QUEUED',
  message: 'Estamos corrigindo o seu texto. Leva alguns segundos.',
  lessonId: 'lesson-1',
  stepIndex: 3,
  source: 'TEXT',
  text: "I'm Lucas.",
  result: null,
  createdAt: new Date().toISOString(),
  completedAt: null,
};

const roleplayFixture = {
  id: 'roleplay-1',
  status: 'ACTIVE',
  freeScenario: false,
  scenario: 'Você encontra a Maya no elevador.',
  character: { name: 'Maya', bio: 'Vizinha simpática.' },
  goals: [{ id: 'tell-name', description: 'Dizer o seu nome.', met: false }],
  maxTurns: 10,
  turnsLeft: 10,
  turns: [
    {
      index: 0,
      role: 'CHARACTER',
      text: 'Hey! Going up?',
      status: 'DONE',
      feedback: null,
    },
  ],
  summary: null,
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('createCorrection', () => {
  it('pede a correção e devolve o status inicial', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(correctionFixture));
    vi.stubGlobal('fetch', fetchMock);

    const correction = await createCorrection({
      lessonId: 'lesson-1',
      stepIndex: 3,
      text: "I'm Lucas.",
    });

    expect(correction.status).toBe('QUEUED');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/tutor/corrections',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('getCorrection', () => {
  it('busca o resultado da correção', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...correctionFixture,
        status: 'DONE',
        result: {
          safety: 'OK',
          corrected: "I'm Lucas.",
          fixes: [],
          rubric: [],
          registerTips: [],
          encouragement: 'Mandou bem!',
          estimatedLevel: 'A1',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const correction = await getCorrection('correction-1');

    expect(correction.result?.encouragement).toBe('Mandou bem!');
  });
});

describe('startRoleplay', () => {
  it('começa a conversa presa à etapa da lição', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(roleplayFixture));
    vi.stubGlobal('fetch', fetchMock);

    const roleplay = await startRoleplay({
      lessonId: 'lesson-1',
      stepIndex: 4,
    });

    expect(roleplay.character.name).toBe('Maya');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/tutor/roleplays',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('getRoleplay', () => {
  it('busca a conversa', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(roleplayFixture));
    vi.stubGlobal('fetch', fetchMock);

    const roleplay = await getRoleplay('roleplay-1');

    expect(roleplay.turns).toHaveLength(1);
  });
});

describe('submitRoleplayTurn', () => {
  it('envia a fala do aluno', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...roleplayFixture,
        turns: [
          ...roleplayFixture.turns,
          {
            index: 1,
            role: 'STUDENT',
            text: "I'm Lucas.",
            status: 'DONE',
            feedback: null,
          },
          {
            index: 2,
            role: 'CHARACTER',
            text: '',
            status: 'PENDING',
            feedback: null,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const roleplay = await submitRoleplayTurn('roleplay-1', {
      text: "I'm Lucas.",
    });

    expect(roleplay.turns.at(-1)?.status).toBe('PENDING');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/tutor/roleplays/roleplay-1/turns',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('finishRoleplay', () => {
  it('encerra e devolve o resumo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...roleplayFixture,
        status: 'FINISHED',
        summary: {
          goals: [
            { id: 'tell-name', description: 'Dizer o seu nome.', met: true },
          ],
          topCorrections: [],
          expressionSkillIds: [],
          finishedBy: 'STUDENT',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const roleplay = await finishRoleplay('roleplay-1');

    expect(roleplay.summary?.finishedBy).toBe('STUDENT');
  });
});
