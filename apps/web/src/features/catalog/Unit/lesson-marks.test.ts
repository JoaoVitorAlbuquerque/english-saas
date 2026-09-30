import type { LessonHistoryEntry } from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import { computeLessonMarks } from './lesson-marks';

function entry(overrides: Partial<LessonHistoryEntry>): LessonHistoryEntry {
  return {
    attemptId: 'attempt-1',
    lessonId: 'lesson-1',
    lessonSlug: 'nice-to-meet-you',
    title: 'Nice to meet you',
    cefrLevel: 'A1',
    version: 1,
    status: 'COMPLETED',
    source: 'PLAN',
    currentStepIndex: 6,
    xpEarned: 30,
    startedAt: '2026-09-28T10:00:00.000Z',
    completedAt: '2026-09-28T10:20:00.000Z',
    ...overrides,
  };
}

describe('computeLessonMarks', () => {
  it('marca concluída quando a única tentativa terminou', () => {
    const marks = computeLessonMarks([entry({ status: 'COMPLETED' })]);
    expect(marks.get('lesson-1')).toEqual({
      completed: true,
      inProgress: false,
    });
  });

  it('marca em andamento quando a tentativa mais recente está aberta', () => {
    const marks = computeLessonMarks([entry({ status: 'IN_PROGRESS' })]);
    expect(marks.get('lesson-1')).toEqual({
      completed: false,
      inProgress: true,
    });
  });

  it('refazer uma lição já concluída mantém as duas marcas', () => {
    // Mais recente primeiro, como o backend devolve.
    const marks = computeLessonMarks([
      entry({ attemptId: 'a2', status: 'IN_PROGRESS' }),
      entry({ attemptId: 'a1', status: 'COMPLETED' }),
    ]);
    expect(marks.get('lesson-1')).toEqual({
      completed: true,
      inProgress: true,
    });
  });

  it('tentativa abandonada não marca nem concluída nem em andamento', () => {
    const marks = computeLessonMarks([entry({ status: 'ABANDONED' })]);
    expect(marks.get('lesson-1')).toEqual({
      completed: false,
      inProgress: false,
    });
  });

  it('lição sem nenhuma tentativa não aparece no mapa', () => {
    const marks = computeLessonMarks([]);
    expect(marks.has('lesson-1')).toBe(false);
  });
});
