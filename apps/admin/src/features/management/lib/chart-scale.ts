import { niceMax, type ChartScale } from '@english-saas/ui';

/**
 * Escala de zero até um teto "redondo" acima do maior valor, com três marcas
 * (0, meio, teto). `format` escreve cada marca — número, dólar, real.
 */
export function valueScale(
  maxValue: number,
  format: (value: number) => string,
): ChartScale {
  const max = niceMax(maxValue);

  return {
    min: 0,
    max,
    ticks: [0, max / 2, max].map((value) => ({ value, label: format(value) })),
  };
}
