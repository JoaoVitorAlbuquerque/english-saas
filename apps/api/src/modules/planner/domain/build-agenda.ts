import type { StudentItem } from 'src/modules/curriculum/domain/student-view';

/**
 * Monta a agenda do dia a partir de candidatos **já buscados** — nenhuma
 * leitura de banco aqui. A ordem é sempre a mesma: revisão vencida, próxima
 * lição do path, prática direcionada das fraquezas, no que sobrar do
 * orçamento. Material do Plus (módulo 13) fica de fora — nem o plano Plus
 * nem o generator existem ainda (ver CLAUDE.md → planner).
 */

/** Só o que o front precisa pra tocar mídia — sem o `MediaKind` do Prisma. */
export type PracticeItemAsset = {
  url: string;
  mimeType: string;
  durationMs: number | null;
};

/** O item completo (sem gabarito), pro bloco de prática ser autossuficiente. */
export type PracticeItem = StudentItem & {
  assets: Record<string, PracticeItemAsset>;
};

export const REVIEW_SHARE = 0.3;
/** Estimativa por item de prática — não tem histórico de tempo fora de lição. */
export const DEFAULT_PRACTICE_ITEM_MINUTES = 1.5;

export type AgendaBlockType = 'REVIEW' | 'LESSON' | 'PRACTICE';

export const AGENDA_SKIP_REASONS = [
  'NO_TIME',
  'ALREADY_KNOW',
  'TOO_HARD',
  'OTHER',
] as const;
export type AgendaSkipReason = (typeof AGENDA_SKIP_REASONS)[number];

export type AgendaBlockStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

/**
 * TODO(planner): o motivo de pular pode virar sinal, não só um rótulo pro
 * aluno. `ALREADY_KNOW` num bloco de `PRACTICE` é candidato a uma checagem
 * rápida (pula pro próximo passo sem repetir o que o aluno diz que já sabe);
 * `TOO_HARD` é candidato a puxar reforço do pré-requisito da skill pro path,
 * do jeito que `checkpoint.completed` já faz (ver `addReinforcement`). Hoje
 * nenhuma lógica nova roda em cima disso — é só o motivo guardado no bloco.
 */

export type AgendaBlock = {
  id: string;
  type: AgendaBlockType;
  refId: string;
  estimatedMinutes: number;
  reason: string;
  /** Título da lição (LESSON). Opcional: agenda antiga não tem. */
  title?: string;
  /** Slug da lição (LESSON) — pro front abrir `/licoes/:slug` direto. */
  slug?: string;
  /** Quantos cards (REVIEW). Opcional: agenda antiga não tem. */
  count?: number;
  /** O item completo (PRACTICE) — sem ele o front não tem o que renderizar. */
  item?: PracticeItem;
};

export type ReviewCandidate = {
  /** Quantos cards vencidos entraram no orçamento de revisão do dia. */
  count: number;
  estimatedMinutes: number;
  hasRecurringError: boolean;
};

export type NextLessonCandidate = {
  lessonId: string;
  slug: string;
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
  item: PracticeItem;
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
      slug: input.nextLesson.slug,
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
      item: candidate.item,
    });
    remaining -= candidate.estimatedMinutes;
  }

  return blocks;
}
