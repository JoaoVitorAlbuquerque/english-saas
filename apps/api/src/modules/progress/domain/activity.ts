import type { Competency } from '@english-saas/shared';

/**
 * A linha do dia de um aluno, montada a partir do que cada módulo conta.
 *
 * Tempo em segundos (minuto inteiro perderia a revisão de 25 s). Flashcard
 * não mede tempo de resposta: vale os mesmos 25 s por card que a sessão de
 * revisão (9) usa para dizer quanto cabe.
 */

export const SECONDS_PER_FLASHCARD = 25;

export type CompetencyTally = Partial<
  Record<Competency, { answered: number; correct: number }>
>;

export type DailyActivityParts = {
  /** Soma do `timeSpentMs` das etapas de lição concluídas no dia. */
  stepTimeMs: number;
  /** Tempo de resposta das questões fora de lição (revisão, material, prova). */
  practiceAnswerMs: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  answers: number;
  firstTryAnswers: number;
  firstTryCorrect: number;
  /** Primeiras tentativas por competência do item. */
  byCompetency: CompetencyTally;
  reviewsDone: number;
  /** Revisões sem questão por trás (flashcard auto-avaliado). */
  flashcardReviews: number;
  aiCalls: number;
  aiCostUsdMicros: number;
  plannedMinutes: number;
};

export type DailyActivity = {
  lessonSeconds: number;
  practiceSeconds: number;
  reviewSeconds: number;
  studySeconds: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  answers: number;
  firstTryAnswers: number;
  firstTryCorrect: number;
  byCompetency: CompetencyTally;
  reviewsDone: number;
  aiCalls: number;
  aiCostUsdMicros: number;
  plannedMinutes: number;
};

export function buildDailyActivity(parts: DailyActivityParts): DailyActivity {
  const lessonSeconds = Math.round(parts.stepTimeMs / 1000);
  const practiceSeconds = Math.round(parts.practiceAnswerMs / 1000);
  const reviewSeconds = parts.flashcardReviews * SECONDS_PER_FLASHCARD;

  return {
    lessonSeconds,
    practiceSeconds,
    reviewSeconds,
    studySeconds: lessonSeconds + practiceSeconds + reviewSeconds,
    lessonsStarted: parts.lessonsStarted,
    lessonsCompleted: parts.lessonsCompleted,
    answers: parts.answers,
    firstTryAnswers: parts.firstTryAnswers,
    firstTryCorrect: parts.firstTryCorrect,
    byCompetency: parts.byCompetency,
    reviewsDone: parts.reviewsDone,
    aiCalls: parts.aiCalls,
    aiCostUsdMicros: parts.aiCostUsdMicros,
    plannedMinutes: parts.plannedMinutes,
  };
}

/**
 * O aluno "esteve ativo" no dia: fez qualquer coisa de estudo ou usou uma
 * ferramenta de IA. Só ter planejado minutos não conta.
 */
export function isActive(
  row: Pick<
    DailyActivity,
    'studySeconds' | 'lessonsStarted' | 'answers' | 'reviewsDone' | 'aiCalls'
  >,
): boolean {
  return (
    row.studySeconds > 0 ||
    row.lessonsStarted > 0 ||
    row.answers > 0 ||
    row.reviewsDone > 0 ||
    row.aiCalls > 0
  );
}

/** Soma tallies de competência (várias linhas de dia → um período). */
export function mergeTallies(
  tallies: readonly CompetencyTally[],
): CompetencyTally {
  const merged: CompetencyTally = {};

  for (const tally of tallies) {
    for (const [competency, value] of Object.entries(tally) as [
      Competency,
      { answered: number; correct: number },
    ][]) {
      const current = merged[competency] ?? { answered: 0, correct: 0 };
      merged[competency] = {
        answered: current.answered + value.answered,
        correct: current.correct + value.correct,
      };
    }
  }

  return merged;
}

export function toMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}
