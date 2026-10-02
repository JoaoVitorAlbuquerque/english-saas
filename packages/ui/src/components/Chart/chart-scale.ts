/**
 * Escala numérica dos gráficos — funções puras, sem DOM. Os gráficos não
 * sabem o que o número significa (nível CEFR, minutos); quem os usa traduz.
 */

export type ChartTick = { value: number; label: string };

export type ChartScale = {
  min: number;
  max: number;
  ticks: readonly ChartTick[];
};

/** Posição do valor na escala, de 0 a 1 (fora da faixa, fica na borda). */
export function scaleRatio(
  value: number,
  scale: Pick<ChartScale, 'min' | 'max'>,
): number {
  const span = scale.max - scale.min;

  if (span <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, (value - scale.min) / span));
}

/**
 * Teto "redondo" para o maior valor de um gráfico de barras (1, 2, 5 ou 10
 * vezes uma potência de dez). Sem dado ou tudo zero, 1 — a barra nunca divide
 * por zero.
 */
export function niceMax(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;
  const step = [1, 2, 5, 10].find((candidate) => normalized <= candidate) ?? 10;

  return step * magnitude;
}

/**
 * Quais rótulos do eixo X mostrar sem sobrepor: com mais de `maxLabels`
 * pontos, mostra de N em N — sempre incluindo o último, que é o "agora".
 */
export function visibleLabelIndexes(
  count: number,
  maxLabels: number,
): number[] {
  if (count <= 0) {
    return [];
  }

  const every = Math.max(1, Math.ceil(count / Math.max(1, maxLabels)));
  const indexes: number[] = [];

  for (let index = count - 1; index >= 0; index -= every) {
    indexes.unshift(index);
  }

  return indexes;
}
