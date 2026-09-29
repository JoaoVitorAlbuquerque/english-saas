import type { ReviewAnswerResult, SessionCard } from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import { initialReviewState, reduceReview } from './review-reducer';

function itemCard(overrides: Partial<SessionCard> = {}): SessionCard {
  return {
    cardId: 'card-1',
    kind: 'SKILL',
    due: new Date().toISOString(),
    exercise: {
      type: 'ITEM',
      item: {
        id: 'item-1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'I ___ Lucas.',
        content: { options: [], shuffle: false },
        cefrLevel: 'A1',
        skillIds: [],
        assets: {},
      },
    },
    ...overrides,
  };
}

function flashcard(overrides: Partial<SessionCard> = {}): SessionCard {
  return {
    cardId: 'card-2',
    kind: 'VOCAB',
    due: new Date().toISOString(),
    exercise: { type: 'FLASHCARD', front: 'hello', back: 'olá' },
    ...overrides,
  };
}

function answerResult(
  overrides: Partial<ReviewAnswerResult> = {},
): ReviewAnswerResult {
  return {
    cardId: 'card-1',
    rating: 'GOOD',
    nextDueAt: new Date().toISOString(),
    state: 'REVIEW',
    ...overrides,
  };
}

describe('reduceReview', () => {
  it('começa em PICK_MINUTES', () => {
    expect(initialReviewState.phase).toBe('PICK_MINUTES');
  });

  it('escolher os minutos entra em LOADING', () => {
    const state = reduceReview(initialReviewState, {
      type: 'MINUTES_PICKED',
      minutes: 10,
    });

    expect(state.phase).toBe('LOADING');
    expect(state.minutes).toBe(10);
  });

  it('sessão carregada com cards vai pra IN_PROGRESS', () => {
    const state = reduceReview(
      { ...initialReviewState, phase: 'LOADING', minutes: 10 },
      { type: 'SESSION_LOADED', cards: [itemCard(), flashcard()] },
    );

    expect(state.phase).toBe('IN_PROGRESS');
    expect(state.cards).toHaveLength(2);
    expect(state.currentIndex).toBe(0);
  });

  it('sessão carregada sem cards vai direto pro resumo', () => {
    const state = reduceReview(
      { ...initialReviewState, phase: 'LOADING', minutes: 10 },
      { type: 'SESSION_LOADED', cards: [] },
    );

    expect(state.phase).toBe('SUMMARY');
  });

  it('falha ao carregar volta pra escolher os minutos, com o erro', () => {
    const state = reduceReview(
      { ...initialReviewState, phase: 'LOADING' },
      { type: 'LOAD_FAILED', message: 'Não deu.' },
    );

    expect(state.phase).toBe('PICK_MINUTES');
    expect(state.error).toBe('Não deu.');
  });

  it('virar o flashcard marca flipped', () => {
    const state = reduceReview(
      { ...initialReviewState, phase: 'IN_PROGRESS', cards: [flashcard()] },
      { type: 'CARD_FLIPPED' },
    );

    expect(state.flipped).toBe(true);
  });

  it('responder avança pro próximo card e reseta o flip', () => {
    const inProgress = {
      ...initialReviewState,
      phase: 'IN_PROGRESS' as const,
      cards: [itemCard(), flashcard()],
      currentIndex: 0,
      flipped: false,
    };

    const state = reduceReview(inProgress, {
      type: 'ANSWER_RECEIVED',
      result: answerResult(),
    });

    expect(state.phase).toBe('IN_PROGRESS');
    expect(state.currentIndex).toBe(1);
    expect(state.reviewedCount).toBe(1);
    expect(state.dueDates).toHaveLength(1);
  });

  it('responder o último card termina a sessão', () => {
    const inProgress = {
      ...initialReviewState,
      phase: 'IN_PROGRESS' as const,
      cards: [itemCard()],
      currentIndex: 0,
    };

    const state = reduceReview(inProgress, {
      type: 'ANSWER_RECEIVED',
      result: answerResult(),
    });

    expect(state.phase).toBe('SUMMARY');
    expect(state.reviewedCount).toBe(1);
  });

  it('reiniciar volta pro estado inicial', () => {
    const finished = {
      ...initialReviewState,
      phase: 'SUMMARY' as const,
      reviewedCount: 5,
    };

    expect(reduceReview(finished, { type: 'RESTARTED' })).toEqual(
      initialReviewState,
    );
  });
});
