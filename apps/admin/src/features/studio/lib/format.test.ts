import type { Draft } from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import { describeDraftError } from './draft-errors';
import { summarizeDraft } from './draft-summary';
import { formatUsdMicros } from './format-usd';

describe('formatUsdMicros', () => {
  it('micros de dólar em texto, com quatro casas', () => {
    expect(formatUsdMicros(42_000)).toBe('US$ 0,0420');
    expect(formatUsdMicros(1_234_567)).toBe('US$ 1,2346');
    expect(formatUsdMicros(0)).toBe('US$ 0,0000');
  });
});

describe('describeDraftError', () => {
  it('traduz o código e diz o que fazer', () => {
    expect(describeDraftError('DRAFT_REQUEST_INVALID')).toMatch(
      /skill ou um personagem não existe/,
    );
    expect(describeDraftError('AI_PROVIDER_UNAVAILABLE')).toMatch(/fora do ar/);
    expect(describeDraftError('AI_VALIDATION_FAILED')).toMatch(/formato/);
  });

  it('código desconhecido aparece como está; sem código, diz isso', () => {
    expect(describeDraftError('ALGO_NOVO')).toBe(
      'O rascunho falhou (código ALGO_NOVO).',
    );
    expect(describeDraftError(null)).toBe(
      'O rascunho falhou, sem um motivo registrado.',
    );
  });
});

describe('summarizeDraft', () => {
  const base: Omit<Draft, 'kind' | 'params'> = {
    id: 'd1',
    status: 'READY',
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
    requestedBy: { id: 'u', name: 'Ana' },
    qaReports: [],
  };

  it('lição: nível e objetivo', () => {
    expect(
      summarizeDraft({
        ...base,
        kind: 'LESSON',
        params: { objective: 'Pedir comida.', level: 'A1' },
      } as Draft),
    ).toBe('A1 · Pedir comida.');
  });

  it('questões: quantidade, skill, nível e tipos escritos', () => {
    expect(
      summarizeDraft({
        ...base,
        kind: 'ITEMS',
        params: {
          skillId: 'grammar.be',
          level: 'A1',
          count: 4,
          types: ['MULTIPLE_CHOICE', 'ORDER_WORDS'],
        },
      } as Draft),
    ).toBe(
      '4 questões · grammar.be · A1 · Múltipla escolha, Ordenar as palavras',
    );
  });

  it('notas: quantidade e nível', () => {
    expect(
      summarizeDraft({
        ...base,
        kind: 'REGISTER_NOTES',
        params: { level: 'A2', count: 3 },
      } as Draft),
    ).toBe('3 notas de registro · A2');
  });
});
