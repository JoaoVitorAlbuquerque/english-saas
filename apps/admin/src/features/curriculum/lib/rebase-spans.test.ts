import type { Span } from '@english-saas/shared';
import { describe, expect, it } from 'vitest';

import { rebaseSpans, renderableSpans } from './rebase-spans';

const grammar = (start: number, end: number): Span => ({
  start,
  end,
  kind: 'GRAMMAR',
  skillId: 'grammar.be',
});

describe('rebaseSpans', () => {
  it('texto igual: nada muda', () => {
    const spans = [grammar(0, 3)];

    expect(rebaseSpans('I am Lucas', 'I am Lucas', spans)).toEqual({
      spans,
      dropped: [],
    });
  });

  it('digitar antes do trecho desloca a marcação', () => {
    const result = rebaseSpans('I am Lucas', 'Oh, I am Lucas', [grammar(2, 4)]);

    expect(result.spans).toEqual([grammar(6, 8)]);
    expect(result.dropped).toEqual([]);
  });

  it('digitar depois do trecho não mexe nele', () => {
    const result = rebaseSpans('I am Lucas', 'I am Lucas.', [grammar(0, 4)]);

    expect(result.spans).toEqual([grammar(0, 4)]);
  });

  it('apagar antes do trecho puxa a marcação para trás', () => {
    const result = rebaseSpans('Oh, I am Lucas', 'I am Lucas', [grammar(6, 8)]);

    expect(result.spans).toEqual([grammar(2, 4)]);
  });

  it('digitar dentro do trecho marcado aumenta a marcação', () => {
    const result = rebaseSpans('I gonna go', 'I am gonna go', [grammar(2, 7)]);

    // "gonna" (2..7) ganhou "am " antes: o miolo está na borda, fora do span.
    expect(result.spans).toEqual([grammar(5, 10)]);

    const inside = rebaseSpans('I gonna go', 'I gonnna go', [grammar(2, 7)]);

    expect(inside.spans).toEqual([grammar(2, 8)]);
    expect(inside.dropped).toEqual([]);
  });

  it('apagar o trecho inteiro derruba a marcação e avisa', () => {
    const span = grammar(2, 4);
    const result = rebaseSpans('I am Lucas', 'I  Lucas', [span]);

    expect(result.spans).toEqual([]);
    expect(result.dropped).toEqual([span]);
  });

  it('cortar o trecho no meio derruba a marcação', () => {
    const span = grammar(0, 6);
    const result = rebaseSpans('Nice to meet you', 'Nice meet you', [span]);

    expect(result.dropped).toEqual([span]);
  });

  it('com várias marcações, cada uma decide por si', () => {
    const before = grammar(0, 1);
    const hit = grammar(2, 4);
    const after = grammar(5, 10);
    const result = rebaseSpans('I am Lucas', 'I a Lucas', [before, hit, after]);

    expect(result.spans).toEqual([before, grammar(2, 3), grammar(4, 9)]);
    expect(result.dropped).toEqual([]);
  });

  it('marcação de registro e vocabulário mantêm a referência', () => {
    const register: Span = {
      start: 4,
      end: 7,
      kind: 'REGISTER',
      registerNoteId: 'gonna',
    };
    const result = rebaseSpans('I am gonna go', '>> I am gonna go', [register]);

    expect(result.spans).toEqual([{ ...register, start: 7, end: 10 }]);
  });

  it('conta em unidades UTF-16, como o servidor', () => {
    const result = rebaseSpans('Café au lait', 'Un café au lait', [
      grammar(5, 7),
    ]);

    expect(result.spans).toEqual([grammar(8, 10)]);
  });
});

describe('renderableSpans', () => {
  it('descarta o que passa do texto, o vazio e o que sobrepõe', () => {
    const text = 'I am Lucas';

    expect(
      renderableSpans(text, [
        grammar(5, 20),
        grammar(0, 4),
        grammar(2, 6),
        grammar(3, 3),
        grammar(5, 10),
      ]),
    ).toEqual([grammar(0, 4), grammar(5, 10)]);
  });
});
