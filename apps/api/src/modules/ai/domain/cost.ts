/**
 * Cálculo de custo de uma chamada de IA.
 *
 * Tudo em **micros de dólar** (milionésimos) e aritmética inteira — dinheiro
 * não anda em float. Os preços nunca ficam fixos aqui: chegam por parâmetro,
 * vindos do `AI_PRICING_JSON` (ver AiPricingService).
 */

export type ModelPricing = {
  /** USD em micros por 1 milhão de tokens de entrada. */
  inputPerMTokUsdMicros: number;
  /** USD em micros por 1 milhão de tokens de saída. */
  outputPerMTokUsdMicros: number;
};

export type PricingTable = Record<string, ModelPricing>;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

const TOKENS_PER_UNIT = 1_000_000;

/**
 * Preço do modelo. Casa por nome exato e, se não achar, pelo prefixo mais
 * longo — assim `gpt-4o-2024-11-20` herda o preço de `gpt-4o` sem precisar
 * de uma entrada por data de release.
 */
export function findModelPricing(
  pricing: PricingTable,
  model: string,
): ModelPricing | undefined {
  const exact = pricing[model];

  if (exact !== undefined) {
    return exact;
  }

  const prefixes = Object.keys(pricing)
    .filter((candidate) => model.startsWith(candidate))
    .sort((a, b) => b.length - a.length);

  const best = prefixes[0];

  return best === undefined ? undefined : pricing[best];
}

/**
 * Custo total em micros de dólar.
 *
 * Modelo sem preço cadastrado devolve 0 — a chamada não pode falhar por
 * causa da tabela de preços, mas o chamador loga o aviso.
 */
export function computeCostUsdMicros(
  pricing: PricingTable,
  model: string,
  usage: TokenUsage,
): number {
  const modelPricing = findModelPricing(pricing, model);

  if (modelPricing === undefined) {
    return 0;
  }

  const input = Math.round(
    (usage.inputTokens * modelPricing.inputPerMTokUsdMicros) / TOKENS_PER_UNIT,
  );
  const output = Math.round(
    (usage.outputTokens * modelPricing.outputPerMTokUsdMicros) /
      TOKENS_PER_UNIT,
  );

  return input + output;
}

/** Formata micros de dólar para exibição. `1_234_567` → `"$1.234567"`. */
export function formatUsdMicros(costUsdMicros: number): string {
  return `$${(costUsdMicros / 1_000_000).toFixed(6)}`;
}
