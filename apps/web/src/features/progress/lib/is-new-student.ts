import type { StudentProgress } from '@english-saas/api-client';

/**
 * Aluno que ainda não deu ao modelo nada para medir: nenhuma competência com
 * nível, nenhum minuto estudado, nenhuma lição, nenhuma revisão e nenhum erro
 * visto. Nesse caso a tela mostra o convite, não gráficos vazios.
 *
 * Um aluno que só fez o nivelamento já tem nível — sai desse estado.
 */
export function isNewStudent(progress: StudentProgress): boolean {
  const { stats, level } = progress;

  return (
    level.competencies.every((competency) => competency.level === null) &&
    stats.minutesStudied === 0 &&
    stats.lessonsCompleted === 0 &&
    stats.reviewsDone === 0 &&
    stats.topErrors.length === 0
  );
}
