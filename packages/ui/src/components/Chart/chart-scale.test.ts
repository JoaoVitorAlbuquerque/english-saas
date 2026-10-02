import { describe, expect, it } from 'vitest';

import { niceMax, scaleRatio, visibleLabelIndexes } from './chart-scale';

describe('scaleRatio', () => {
  const scale = { min: 0, max: 5 };

  it('põe o valor na posição certa e prende nas bordas', () => {
    expect(scaleRatio(0, scale)).toBe(0);
    expect(scaleRatio(2.5, scale)).toBe(0.5);
    expect(scaleRatio(5, scale)).toBe(1);
    expect(scaleRatio(-3, scale)).toBe(0);
    expect(scaleRatio(9, scale)).toBe(1);
  });

  it('escala sem largura não divide por zero', () => {
    expect(scaleRatio(3, { min: 2, max: 2 })).toBe(0);
  });
});

describe('niceMax', () => {
  it('arredonda para cima em 1, 2, 5 ou 10 × potência de dez', () => {
    expect(niceMax(0.7)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(47)).toBe(50);
    expect(niceMax(120)).toBe(200);
    expect(niceMax(100)).toBe(100);
  });

  it('sem dado ou tudo zero, devolve 1', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-4)).toBe(1);
    expect(niceMax(Number.NaN)).toBe(1);
  });
});

describe('visibleLabelIndexes', () => {
  it('mostra todos quando cabem', () => {
    expect(visibleLabelIndexes(4, 7)).toEqual([0, 1, 2, 3]);
  });

  it('de N em N, sempre incluindo o último', () => {
    const indexes = visibleLabelIndexes(26, 7);

    expect(indexes.at(-1)).toBe(25);
    expect(indexes.length).toBeLessThanOrEqual(7);
    expect(visibleLabelIndexes(0, 7)).toEqual([]);
  });
});
