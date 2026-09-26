/**
 * Monta a agenda do dia a partir de candidatos **já buscados** — nenhuma
 * leitura de banco aqui. A ordem é sempre a mesma: revisão vencida, próxima
 * lição do path, prática direcionada das fraquezas, no que sobrar do
 * orçamento. Material do Plus (módulo 13) fica de fora — nem o plano Plus
 * nem o generator existem ainda (ver CLAUDE.md → planner).
 */

export const REVIEW_SHARE = 0.3;
/** Estimativa por item de prática — não tem histórico de tempo fora de lição. */
export const DEFAULT_PRACTICE_ITEM_MINUTES = 1.5;

export type AgendaBlockType = 'REVIEW' | 'LESSON' | 'PRACTICE';

export type AgendaBlock = {
  id: string;
  type: AgendaBlockType;
  refId: string;
  estimatedMinutes: number;
  reason: string;
  /** Título da lição (LESSON). Opcional: agenda antiga não tem. */
  title?: string;
  /** Quantos cards (REVIEW). Opcional: agenda antiga não tem. */
  count?: number;
};

export type ReviewCandidate = {
  /** Quantos cards vencidos entraram no orçamento de revisão do dia. */
  count: number;
  estimatedMinutes: number;
  hasRecurringError: boolean;
};

export type NextLessonCandidate = {
  lessonId: string;
  title: string;
  estimatedMinutes: number;
  reason: string;
};

export type PracticeCandidate = {
  itemId: string;
  skillId: string;
  skillTitle: string;
  estimatedMinutes: number;
  /** Vezes que o erro apareceu na janela recente (7), null = sem padrão de erro. */
  recentOccurrences: number | null;
};

function practiceReason(candidate: PracticeCandidate): string {
  if (
    candidate.recentOccurrences !== null &&
    candidate.recentOccurrences >= 3
  ) {
    return `Você tem errado "${candidate.skillTitle}" com frequência.`;
  }

  return `Ainda vale praticar "${candidate.skillTitle}".`;
}

export function buildAgenda(input: {
  budgetMinutes: number;
  review: ReviewCandidate | null;
  nextLesson: NextLessonCandidate | null;
  practice: readonly PracticeCandidate[];
}): AgendaBlock[] {
  const blocks: AgendaBlock[] = [];
  let remaining = Math.max(0, input.budgetMinutes);

  if (input.review !== null && input.review.count > 0) {
    const minutes = Math.min(input.review.estimatedMinutes, remaining);

    if (minutes > 0) {
      blocks.push({
        id: 'review',
        type: 'REVIEW',
        refId: 'review',
        estimatedMinutes: minutes,
        count: input.review.count,
        reason: input.review.hasRecurringError
          ? `${String(input.review.count)} cards de revisão vencidos, alguns de erros recorrentes.`
          : `${String(input.review.count)} cards de revisão vencidos.`,
      });
      remaining -= minutes;
    }
  }

  if (
    input.nextLesson !== null &&
    input.nextLesson.estimatedMinutes <= remaining
  ) {
    blocks.push({
      id: `lesson:${input.nextLesson.lessonId}`,
      type: 'LESSON',
      refId: input.nextLesson.lessonId,
      estimatedMinutes: input.nextLesson.estimatedMinutes,
      title: input.nextLesson.title,
      reason: input.nextLesson.reason,
    });
    remaining -= input.nextLesson.estimatedMinutes;
  }

  for (const candidate of input.practice) {
    if (candidate.estimatedMinutes > remaining) break;

    blocks.push({
      id: `practice:${candidate.itemId}`,
      type: 'PRACTICE',
      refId: candidate.itemId,
      estimatedMinutes: candidate.estimatedMinutes,
      reason: practiceReason(candidate),
    });
    remaining -= candidate.estimatedMinutes;
  }

  return blocks;
}
