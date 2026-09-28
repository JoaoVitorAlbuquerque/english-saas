import type {
  AnswerResult,
  AttemptView,
  CatalogLesson,
  CompletionResult,
} from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import {
  estimatedAnswerXp,
  initialLessonState,
  reduceLesson,
} from './lesson-reducer';

const lesson = { id: 'lesson-1', slug: 'nice-to-meet-you' } as CatalogLesson;

function attempt(overrides: Partial<AttemptView> = {}): AttemptView {
  return {
    id: 'attempt-1',
    lessonId: 'lesson-1',
    lessonVersionId: 'version-1',
    version: 1,
    status: 'IN_PROGRESS',
    source: 'FREE_BROWSE',
    currentStepIndex: 0,
    totalSteps: 6,
    steps: [],
    answeredItemIds: [],
    xpEarned: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function answerResult(overrides: Partial<AnswerResult> = {}): AnswerResult {
  return {
    answerId: 'answer-1',
    isCorrect: true,
    score: 1,
    verdict: 'CORRECT',
    feedback: 'Boa!',
    explanation: 'Explicação.',
    correctAnswer: { text: 'am' },
    errorPatterns: [],
    isFirstTry: true,
    ...overrides,
  };
}

describe('estimatedAnswerXp', () => {
  it('vale até 10, proporcional ao score, só na primeira tentativa', () => {
    expect(
      estimatedAnswerXp(answerResult({ score: 1, isFirstTry: true })),
    ).toBe(10);
    expect(
      estimatedAnswerXp(answerResult({ score: 0.5, isFirstTry: true })),
    ).toBe(5);
  });

  it('não rende XP numa repetição', () => {
    expect(
      estimatedAnswerXp(answerResult({ score: 1, isFirstTry: false })),
    ).toBe(0);
  });
});

describe('reduceLesson', () => {
  it('LESSON_LOADED guarda a lição e limpa erro', () => {
    const state = reduceLesson(
      { ...initialLessonState, error: 'algo' },
      { type: 'LESSON_LOADED', lesson },
    );

    expect(state.lesson).toBe(lesson);
    expect(state.error).toBeNull();
  });

  it('ATTEMPT_LOADED sincroniza a etapa atual com a tentativa', () => {
    const state = reduceLesson(initialLessonState, {
      type: 'ATTEMPT_LOADED',
      attempt: attempt({ currentStepIndex: 2 }),
    });

    expect(state.attempt?.id).toBe('attempt-1');
    expect(state.currentStepIndex).toBe(2);
  });

  it('ANSWER_RECEIVED guarda a resposta e soma o XP estimado da sessão', () => {
    const afterFirst = reduceLesson(initialLessonState, {
      type: 'ANSWER_RECEIVED',
      itemId: 'item-1',
      result: answerResult({ score: 1 }),
    });

    expect(afterFirst.answers['item-1']?.isCorrect).toBe(true);
    expect(afterFirst.sessionXp).toBe(10);

    const afterSecond = reduceLesson(afterFirst, {
      type: 'ANSWER_RECEIVED',
      itemId: 'item-2',
      result: answerResult({ score: 0.5, isFirstTry: true }),
    });

    expect(afterSecond.sessionXp).toBe(15);
    expect(Object.keys(afterSecond.answers)).toHaveLength(2);
  });

  it('STEP_COMPLETED avança a etapa sem mexer nas respostas já dadas', () => {
    const withAnswer = reduceLesson(initialLessonState, {
      type: 'ANSWER_RECEIVED',
      itemId: 'item-1',
      result: answerResult(),
    });

    const state = reduceLesson(withAnswer, {
      type: 'STEP_COMPLETED',
      attempt: attempt({ currentStepIndex: 1 }),
    });

    expect(state.currentStepIndex).toBe(1);
    expect(state.answers['item-1']).toBeDefined();
  });

  it('LESSON_COMPLETED grava o xp autoritativo', () => {
    const result: CompletionResult = {
      attempt: attempt({ status: 'COMPLETED', currentStepIndex: 6 }),
      xp: { fromAnswers: 20, completionBonus: 20, total: 40 },
      stats: {
        totalXp: 40,
        currentStreak: 1,
        longestStreak: 1,
        lastStudyDate: '2026-01-01',
      },
    };

    const state = reduceLesson(initialLessonState, {
      type: 'LESSON_COMPLETED',
      result,
    });

    expect(state.attempt?.status).toBe('COMPLETED');
    expect(state.completionXp?.total).toBe(40);
  });

  it('RESTARTED zera XP, respostas e xp de conclusão', () => {
    const midLesson = reduceLesson(initialLessonState, {
      type: 'ANSWER_RECEIVED',
      itemId: 'item-1',
      result: answerResult(),
    });

    const state = reduceLesson(midLesson, {
      type: 'RESTARTED',
      attempt: attempt({ id: 'attempt-2' }),
    });

    expect(state.attempt?.id).toBe('attempt-2');
    expect(state.sessionXp).toBe(0);
    expect(state.answers).toEqual({});
    expect(state.completionXp).toBeNull();
  });

  it('ERROR_RAISED e ERROR_CLEARED', () => {
    const withError = reduceLesson(initialLessonState, {
      type: 'ERROR_RAISED',
      message: 'Não deu para responder agora.',
    });
    expect(withError.error).toBe('Não deu para responder agora.');

    const cleared = reduceLesson(withError, { type: 'ERROR_CLEARED' });
    expect(cleared.error).toBeNull();
  });
});
