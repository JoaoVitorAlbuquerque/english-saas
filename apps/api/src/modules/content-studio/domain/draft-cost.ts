/**
 * Estimativa de custo de um pedido de rascunho.
 *
 * Não há como saber o custo antes de a IA responder (o tamanho da saída é dela),
 * então a estimativa é a **média do que pedidos parecidos já custaram**: por
 * rascunho, no caso da lição; por questão ou nota, nos pedidos de várias
 * unidades — multiplicada pela quantidade pedida. Sem histórico, não há número:
 * inventar um seria pior que dizer que não sabe.
 */

export type DraftKind = 'LESSON' | 'ITEMS' | 'REGISTER_NOTES';

export type DraftCostSample = {
  kind: DraftKind;
  /** Custo real, em micros de dólar. Nulo/0 = provedor sem preço (fake). */
  costUsdMicros: number | null;
  /** Quantas questões ou notas o pedido pediu (`params.count`). */
  count: number | null;
};

export type DraftCostEstimate = {
  /** `null` quando não há histórico que sirva. */
  usdMicros: number | null;
  /** Quantos pedidos entraram na média. */
  basedOn: number;
};

/** Quantas unidades (questões/notas) um pedido gerou, ou 1 para a lição. */
function unitsOf(sample: DraftCostSample): number {
  if (sample.kind === 'LESSON') {
    return 1;
  }

  return sample.count !== null && sample.count > 0 ? sample.count : 0;
}

export function estimateDraftCost(
  history: readonly DraftCostSample[],
  kind: DraftKind,
  count: number,
): DraftCostEstimate {
  const usable = history.filter(
    (sample) =>
      sample.kind === kind &&
      sample.costUsdMicros !== null &&
      sample.costUsdMicros > 0 &&
      unitsOf(sample) > 0,
  );

  if (usable.length === 0) {
    return { usdMicros: null, basedOn: 0 };
  }

  const perUnit =
    usable.reduce(
      (sum, sample) => sum + (sample.costUsdMicros ?? 0) / unitsOf(sample),
      0,
    ) / usable.length;

  const units = kind === 'LESSON' ? 1 : Math.max(1, count);

  return { usdMicros: Math.round(perUnit * units), basedOn: usable.length };
}
