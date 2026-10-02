import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { getLearnerProfile } from '../learner-model/service';
import { getProgress } from './service';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const progressFixture = {
  period: { from: '2026-08-10', to: '2026-10-05', weeks: 8 },
  level: {
    overall: {
      level: 'A2',
      label: 'Básico',
      note: 'Calculado a partir das suas respostas.',
    },
    competencies: [
      {
        competency: 'GRAMMAR',
        label: 'Gramática',
        level: 'A2',
        confidence: 'Estimativa razoável',
        confidenceLevel: 'MEDIUM',
      },
      {
        competency: 'SPEAKING',
        label: 'Fala',
        level: null,
        confidence: 'Ainda poucos dados',
        confidenceLevel: 'LOW',
      },
    ],
    weekly: [
      { weekStart: '2026-09-28', overallLevel: null, levels: {} },
      {
        weekStart: '2026-10-05',
        overallLevel: 'A2',
        levels: { GRAMMAR: 'A2' },
      },
    ],
  },
  strengths: [
    {
      skillId: 's1',
      title: 'Se apresentar',
      text: 'Você já domina: Se apresentar.',
    },
  ],
  weaknesses: [
    {
      skillId: 's2',
      title: 'Passado simples',
      text: 'Vale reforçar: Passado simples.',
      action: {
        type: 'LESSON',
        refId: 'lesson-1',
        lessonSlug: 'yesterday',
        label: 'Faça a lição "Yesterday"',
      },
    },
  ],
  stats: {
    minutesStudied: 120,
    lessonsCompleted: 2,
    reviewsDone: 14,
    currentStreak: 3,
    longestStreak: 5,
    accuracyByCompetency: [],
    topErrors: [
      {
        errorPatternId: 'l1.have-for-age',
        description: 'I have 20 years',
        correction: 'I am 20 years old',
        recentOccurrences: 3,
        opportunities: 8,
        trend: 'DECREASING',
        trendLabel: 'Está diminuindo',
      },
    ],
  },
  plan: {
    weeks: [
      {
        weekStart: '2026-09-28',
        plannedMinutes: 120,
        studiedMinutes: 90,
        ratio: 0.75,
      },
    ],
  },
  forecast: {
    byPlan: '2027-03-01',
    byPace: null,
    weeksDifference: null,
    status: 'TOO_EARLY',
    message: 'Pelo seu cronograma, você chega lá em 01/03/2027.',
    targetLevel: 'B1',
  },
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('getProgress', () => {
  it('pede o período em semanas e valida o painel', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(progressFixture));
    vi.stubGlobal('fetch', fetchMock);

    const progress = await getProgress(12);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.local/me/progress?weeks=12',
    );
    expect(progress.level.competencies[1]).toMatchObject({
      level: null,
      confidenceLevel: 'LOW',
    });
    expect(progress.weaknesses[0]?.action.lessonSlug).toBe('yesterday');
  });

  it('sem período, usa as 8 semanas padrão da API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(progressFixture));
    vi.stubGlobal('fetch', fetchMock);

    await getProgress();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.local/me/progress?weeks=8',
    );
  });

  it('recusa resposta fora do contrato (confiança desconhecida)', async () => {
    const broken = structuredClone(progressFixture);
    (
      broken.level.competencies[0] as { confidenceLevel: string }
    ).confidenceLevel = 'ALTA';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(broken)));

    await expect(getProgress()).rejects.toBeDefined();
  });
});

describe('getLearnerProfile', () => {
  it('lê os erros com as frases reais do aluno e ignora o resto do perfil', async () => {
    const error = {
      id: 'l1.have-for-age',
      description: 'I have 20 years',
      correction: 'I am 20 years old',
      explanation: 'Em inglês, idade é "to be".',
      occurrences: 3,
      yourExamples: ['I have 22 years'],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          overallLevel: { level: 'A2' },
          errors: [error],
          observedErrors: [],
          needs: [],
        }),
      ),
    );

    const profile = await getLearnerProfile();

    expect(profile.errors[0]?.yourExamples).toEqual(['I have 22 years']);
    expect(profile.observedErrors).toEqual([]);
  });
});
