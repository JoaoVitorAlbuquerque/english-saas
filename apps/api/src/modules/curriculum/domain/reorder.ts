/**
 * Reordenar irmãos (unidades de um nível, lições de uma unidade).
 *
 * `units` tem `@@unique([levelId, order])` e `lessons`, `@@unique([unitId,
 * order])`. Trocar dois itens com dois `UPDATE` esbarra na unicidade no meio
 * do caminho, então a escrita é em duas fases e o plano sai daqui, puro.
 */

export type ReorderIssue = 'EMPTY' | 'DUPLICATE' | 'MISMATCH';

export type ReorderPlan =
  | { ok: true; steps: { id: string; order: number }[] }
  | {
      ok: false;
      reason: ReorderIssue;
      /** Ids atuais que ficaram de fora do pedido. */
      missing: string[];
      /** Ids do pedido que não são irmãos atuais. */
      unknown: string[];
    };

/**
 * `requestedIds` precisa ser exatamente o conjunto atual de irmãos, só que na
 * ordem nova. O resultado é sempre `order` 0..n-1: a ordem densa é efeito
 * colateral de reordenar, e o catálogo só usa a posição relativa.
 */
export function planReorder(
  currentIds: readonly string[],
  requestedIds: readonly string[],
): ReorderPlan {
  if (requestedIds.length === 0) {
    return {
      ok: false,
      reason: 'EMPTY',
      missing: [...currentIds],
      unknown: [],
    };
  }

  if (new Set(requestedIds).size !== requestedIds.length) {
    return { ok: false, reason: 'DUPLICATE', missing: [], unknown: [] };
  }

  const current = new Set(currentIds);
  const requested = new Set(requestedIds);
  const missing = currentIds.filter((id) => !requested.has(id));
  const unknown = requestedIds.filter((id) => !current.has(id));

  if (missing.length > 0 || unknown.length > 0) {
    return { ok: false, reason: 'MISMATCH', missing, unknown };
  }

  return {
    ok: true,
    steps: requestedIds.map((id, order) => ({ id, order })),
  };
}

/**
 * Primeiro `order` livre acima de todos os atuais: a fase 1 manda cada irmão
 * para `base + posição`, onde ninguém está, e só então a fase 2 grava 0..n-1.
 */
export function temporaryOrderBase(currentOrders: readonly number[]): number {
  return currentOrders.length === 0 ? 0 : Math.max(...currentOrders) + 1;
}
