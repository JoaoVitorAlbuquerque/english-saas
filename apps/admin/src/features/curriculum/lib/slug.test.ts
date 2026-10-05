import { contentSlugSchema } from '@english-saas/shared';
import { describe, expect, it } from 'vitest';

import { slugify } from './slug';

describe('slugify', () => {
  it('tira acento, baixa a caixa e troca o resto por hífen', () => {
    expect(slugify('Nice to meet you')).toBe('nice-to-meet-you');
    expect(slugify('Pedir um café!')).toBe('pedir-um-cafe');
    expect(slugify('  A1 · Unidade 1 — Vizinhos  ')).toBe(
      'a1-unidade-1-vizinhos',
    );
  });

  it('o resultado passa no schema de slug do shared', () => {
    for (const title of ['Nice to meet you', 'Pedir um café!', 'A1 / U1']) {
      expect(contentSlugSchema.safeParse(slugify(title)).success).toBe(true);
    }
  });

  it('título sem letra nem número vira vazio, e corta em 80 sem deixar hífen na ponta', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('a'.repeat(79) + ' b')).toBe('a'.repeat(79));
  });
});
