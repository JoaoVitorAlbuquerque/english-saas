/**
 * Andamento de uma tentativa de lição.
 *
 * O aluno conclui etapas em qualquer ordem — conteúdo não se trava por
 * progresso (CLAUDE.md). A única exigência é a da prática: a etapa PRACTICE
 * fecha quando cada questão dela tem ao menos uma resposta, certa ou
 * errada. Sem isso, "concluir a prática" seria um botão de pular.
 */

/** Primeira etapa ainda não concluída; `totalSteps` quando não sobra nenhuma. */
export function nextStepIndex(
  totalSteps: number,
  completed: Iterable<number>,
): number {
  const done = new Set(completed);

  for (let index = 0; index < totalSteps; index += 1) {
    if (!done.has(index)) {
      return index;
    }
  }

  return totalSteps;
}

/** Etapas que faltam, em ordem. */
export function missingSteps(
  totalSteps: number,
  completed: Iterable<number>,
): number[] {
  const done = new Set(completed);

  return Array.from({ length: totalSteps }, (_, index) => index).filter(
    (index) => !done.has(index),
  );
}

/** Questões da prática sem nenhuma resposta nesta tentativa. */
export function unansweredItems(
  practiceItemIds: readonly string[],
  answeredItemIds: Iterable<string>,
): string[] {
  const answered = new Set(answeredItemIds);
  return practiceItemIds.filter((id) => !answered.has(id));
}

export type StartDecision =
  | { action: 'START' }
  | { action: 'RESUME'; attemptId: string }
  /** A lição foi republicada: a tentativa aberta é de uma versão que saiu do ar. */
  | { action: 'RESTART'; abandonAttemptId: string };

/**
 * Iniciar ou retomar.
 *
 * Tentativa aberta na versão que está no ar → retoma. Aberta numa versão
 * antiga → larga e começa de novo: o catálogo só entrega a versão
 * publicada, e continuar a antiga misturaria etapas de duas versões.
 */
export function decideStart(
  open: { id: string; lessonVersionId: string } | null,
  publishedVersionId: string,
): StartDecision {
  if (open === null) {
    return { action: 'START' };
  }

  return open.lessonVersionId === publishedVersionId
    ? { action: 'RESUME', attemptId: open.id }
    : { action: 'RESTART', abandonAttemptId: open.id };
}
