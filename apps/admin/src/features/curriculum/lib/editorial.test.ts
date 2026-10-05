import { CONTENT_STATUSES } from '@english-saas/shared';
import { describe, expect, it } from 'vitest';

import {
  availableActions,
  describeEditorialError,
  isEditableStatus,
  needsConfirmation,
  nextVersionStatus,
  statusAfterEdit,
} from './editorial';

describe('fluxo editorial', () => {
  it('cada ação leva ao status certo', () => {
    expect(nextVersionStatus('DRAFT', 'submit-for-review')).toBe('IN_REVIEW');
    expect(nextVersionStatus('IN_REVIEW', 'approve')).toBe('APPROVED');
    expect(nextVersionStatus('APPROVED', 'publish')).toBe('PUBLISHED');
    expect(nextVersionStatus('IN_REVIEW', 'reject')).toBe('DRAFT');
    expect(nextVersionStatus('APPROVED', 'reject')).toBe('DRAFT');
    expect(nextVersionStatus('PUBLISHED', 'archive')).toBe('ARCHIVED');
  });

  it('só aprovado publica; rascunho não pula direto', () => {
    for (const status of CONTENT_STATUSES) {
      expect(nextVersionStatus(status, 'publish') !== null).toBe(
        status === 'APPROVED',
      );
    }
  });

  it('os botões de cada status', () => {
    expect(availableActions('DRAFT')).toEqual(['submit-for-review', 'archive']);
    expect(availableActions('IN_REVIEW')).toEqual([
      'approve',
      'reject',
      'archive',
    ]);
    expect(availableActions('APPROVED')).toEqual([
      'publish',
      'reject',
      'archive',
    ]);
    expect(availableActions('PUBLISHED')).toEqual(['archive']);
    expect(availableActions('ARCHIVED')).toEqual([]);
  });

  it('publicada e arquivada não se editam; revisada volta a rascunho', () => {
    expect(isEditableStatus('DRAFT')).toBe(true);
    expect(isEditableStatus('IN_REVIEW')).toBe(true);
    expect(isEditableStatus('APPROVED')).toBe(true);
    expect(isEditableStatus('PUBLISHED')).toBe(false);
    expect(isEditableStatus('ARCHIVED')).toBe(false);

    expect(statusAfterEdit('IN_REVIEW')).toBe('DRAFT');
    expect(statusAfterEdit('APPROVED')).toBe('DRAFT');
    expect(statusAfterEdit('DRAFT')).toBe('DRAFT');
  });

  it('publicar e arquivar pedem confirmação', () => {
    expect(needsConfirmation('publish')).toBe(true);
    expect(needsConfirmation('archive')).toBe(true);
    expect(needsConfirmation('approve')).toBe(false);
    expect(needsConfirmation('submit-for-review')).toBe(false);
  });
});

describe('describeEditorialError', () => {
  it('validação: devolve as etapas com problema', () => {
    const problem = describeEditorialError({
      code: 'CONTENT_VALIDATION_FAILED',
      message: 'O conteúdo tem problemas.',
      details: {
        issues: [
          { order: 0, path: 'lines.0.text', message: 'Preencha este campo.' },
          { order: -1, path: 'steps', message: 'Sem etapa.' },
          { nope: true },
        ],
      },
    });

    expect(problem).toEqual({
      kind: 'validation',
      message: 'O conteúdo tem problemas.',
      issues: [
        { order: 0, path: 'lines.0.text', message: 'Preencha este campo.' },
        { order: -1, path: 'steps', message: 'Sem etapa.' },
      ],
    });
  });

  it('referências que faltam, por tipo', () => {
    const problem = describeEditorialError({
      code: 'MISSING_REFERENCES',
      message: 'Aponta para coisas que não existem.',
      details: { skills: ['grammar.x'], items: [], characters: ['abc'] },
    });

    expect(problem).toMatchObject({
      kind: 'references',
      missing: { skills: ['grammar.x'], characters: ['abc'] },
    });
    expect((problem as { missing: object }).missing).not.toHaveProperty(
      'items',
    );
  });

  it('bloqueadores da revisão automática', () => {
    const problem = describeEditorialError({
      code: 'QA_BLOCKERS',
      message: 'A revisão automática encontrou 1 problema.',
      details: {
        blockers: [
          {
            code: 'LEVEL_TOO_HIGH',
            message: 'Texto acima do nível.',
            path: 'steps.0',
          },
        ],
      },
    });

    expect(problem).toEqual({
      kind: 'qa',
      message: 'A revisão automática encontrou 1 problema.',
      blockers: [
        {
          code: 'LEVEL_TOO_HIGH',
          message: 'Texto acima do nível.',
          path: 'steps.0',
        },
      ],
    });
  });

  it('áudio faltando, versão aberta e transição inválida', () => {
    expect(
      describeEditorialError({
        code: 'MISSING_AUDIO',
        message: '2 trechos sem áudio.',
        details: { missing: ['step:0:line:1', 'step:0:line:2'] },
      }),
    ).toMatchObject({
      kind: 'audio',
      missing: ['step:0:line:1', 'step:0:line:2'],
    });

    expect(
      describeEditorialError({
        code: 'DRAFT_ALREADY_OPEN',
        message: 'A versão 3 ainda está aberta.',
        details: { version: 3 },
      }),
    ).toMatchObject({ kind: 'draft-open', version: 3 });

    expect(
      describeEditorialError({
        code: 'INVALID_CONTENT_TRANSITION',
        message: 'Não dá para publicar.',
      }),
    ).toMatchObject({ kind: 'transition' });
  });

  it('qualquer outro erro vira "other" com a mensagem da API', () => {
    expect(
      describeEditorialError({ code: 'NETWORK_ERROR', message: 'Sem rede.' }),
    ).toEqual({ kind: 'other', message: 'Sem rede.' });
  });
});
