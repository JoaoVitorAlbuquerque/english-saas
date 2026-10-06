import { describe, expect, it } from 'vitest';

import { describeItemError, issuesOfProblem } from './item-editorial';

describe('describeItemError', () => {
  it('validação: o caminho do servidor vira o campo da tela', () => {
    const problem = describeItemError({
      code: 'CONTENT_VALIDATION_FAILED',
      message: 'O conteúdo tem problemas.',
      details: {
        issues: [
          { path: 'options.0.text', message: 'Preencha este campo.' },
          { path: 'acceptedAnswers', message: 'Falta a resposta.' },
          { path: 'errorPatternMap', message: 'Chave vazia.' },
          { path: 'content', message: 'Conteúdo inválido.' },
        ],
      },
    });

    expect(problem).toEqual({
      kind: 'validation',
      message: 'O conteúdo tem problemas.',
      issues: [
        { path: 'content.options.0.text', message: 'Preencha este campo.' },
        { path: 'acceptedAnswers', message: 'Falta a resposta.' },
        { path: 'errorPatternMap', message: 'Chave vazia.' },
        { path: 'content', message: 'Conteúdo inválido.' },
      ],
    });
    expect(issuesOfProblem(problem)).toHaveLength(4);
  });

  it('referências: o que falta, por tipo, e o motivo à parte', () => {
    expect(
      describeItemError({
        code: 'MISSING_REFERENCES',
        message: 'Aponta para o que não existe.',
        details: {
          skills: ['grammar.sumiu'],
          registerNotes: [],
          reason: 'A nota não existe.',
        },
      }),
    ).toEqual({
      kind: 'references',
      message: 'Aponta para o que não existe.',
      missing: { skills: ['grammar.sumiu'] },
      reason: 'A nota não existe.',
    });
  });

  it('imutável: quais campos, e em uso: quais lições', () => {
    expect(
      describeItemError({
        code: 'ITEM_IS_IMMUTABLE',
        message: 'Já foi publicado.',
        details: { fields: ['prompt', 'content'] },
      }),
    ).toEqual({
      kind: 'immutable',
      message: 'Já foi publicado.',
      fields: ['prompt', 'content'],
    });
    expect(
      describeItemError({
        code: 'ITEM_IN_USE',
        message: 'Está em uso.',
        details: { lessons: ['nice-to-meet-you'] },
      }),
    ).toEqual({
      kind: 'in-use',
      message: 'Está em uso.',
      lessons: ['nice-to-meet-you'],
    });
  });

  it('transição inválida e o resto', () => {
    expect(
      describeItemError({
        code: 'INVALID_CONTENT_TRANSITION',
        message: 'Não dá.',
      }),
    ).toEqual({ kind: 'transition', message: 'Não dá.' });
    expect(
      describeItemError({ code: 'INTERNAL_ERROR', message: 'Deu ruim.' }),
    ).toEqual({ kind: 'other', message: 'Deu ruim.' });
    expect(issuesOfProblem(null)).toEqual([]);
  });

  it('não quebra com detalhes mal formados', () => {
    expect(
      describeItemError({
        code: 'CONTENT_VALIDATION_FAILED',
        message: 'x',
        details: { issues: [null, 3, { path: 1 }] },
      }),
    ).toEqual({ kind: 'validation', message: 'x', issues: [] });
  });
});
