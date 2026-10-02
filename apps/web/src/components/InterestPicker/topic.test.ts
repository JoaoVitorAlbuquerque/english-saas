import { describe, expect, it } from 'vitest';

import { normalizeText, toTopicSlug } from './topic';

describe('normalizeText', () => {
  it('tira acento, caixa e espaço das pontas', () => {
    expect(normalizeText('  História ')).toBe('historia');
  });
});

describe('toTopicSlug', () => {
  it('vira slug que a API aceita', () => {
    expect(toTopicSlug('Copa do Mundo')).toBe('copa-do-mundo');
    expect(toTopicSlug('Culinária!')).toBe('culinaria');
    expect(toTopicSlug('  K-pop  ')).toBe('k-pop');
  });

  it('recusa o que não vira um tema válido', () => {
    expect(toTopicSlug('!!')).toBeNull();
    expect(toTopicSlug('a')).toBeNull();
    expect(toTopicSlug('')).toBeNull();
  });

  it('corta no teto de 40 caracteres sem deixar hífen no fim', () => {
    const slug = toTopicSlug(`${'a'.repeat(39)} bbbb`);

    expect(slug).toHaveLength(39);
    expect(slug?.endsWith('-')).toBe(false);
  });
});
