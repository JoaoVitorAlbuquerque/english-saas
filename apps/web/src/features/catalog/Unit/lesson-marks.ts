import type { LessonHistoryEntry } from '@english-saas/api-client';

export type LessonMark = { completed: boolean; inProgress: boolean };

/**
 * `GET /me/history` vem do mais recente pro mais antigo. Uma lição pode ter
 * mais de uma tentativa (refazer depois de concluir): "concluída" é
 * verdade se QUALQUER tentativa terminou; "em andamento" só olha a mais
 * recente — é o que decide se ainda tem algo pendente pra continuar.
 */
export function computeLessonMarks(
  history: readonly LessonHistoryEntry[],
): Map<string, LessonMark> {
  const marks = new Map<string, LessonMark>();

  for (const entry of history) {
    const current = marks.get(entry.lessonId) ?? {
      completed: false,
      inProgress: false,
    };
    const isMostRecent = !marks.has(entry.lessonId);

    marks.set(entry.lessonId, {
      completed: current.completed || entry.status === 'COMPLETED',
      inProgress: isMostRecent
        ? entry.status === 'IN_PROGRESS'
        : current.inProgress,
    });
  }

  return marks;
}
