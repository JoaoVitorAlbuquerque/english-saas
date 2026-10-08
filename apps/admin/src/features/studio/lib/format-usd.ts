const usd = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/**
 * Micros de dólar (a unidade da API) em texto: `42_000` → `US$ 0,0420`.
 * Quatro casas: um rascunho custa frações de centavo.
 */
export function formatUsdMicros(micros: number): string {
  // O espaço entre o símbolo e o número é inseparável; um comum lê melhor e testa melhor.
  return usd.format(micros / 1_000_000).replace(/\p{Zs}/gu, ' ');
}
