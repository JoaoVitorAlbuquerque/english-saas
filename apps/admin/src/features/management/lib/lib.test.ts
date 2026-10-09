import type { AuditEntry, Cohort, PlanView } from '@english-saas/api-client';
import { describe, expect, it } from 'vitest';

import { describeAudit } from './audit-text';
import { validateGrant } from './grant-form';
import { studentStatus } from './labels';
import { centsToInput, formatBrlCents, parseBrlToCents } from './money';
import {
  addDays,
  daysInRange,
  localDayBounds,
  presetOf,
  presetRange,
  rangeProblem,
} from './period';
import { draftOf, planPatch } from './plan-form';
import { buildRetentionMatrix, formatRate, retentionTone } from './retention';

describe('dinheiro', () => {
  it('formata centavos em reais, com espaço comum', () => {
    expect(formatBrlCents(6990)).toBe('R$ 69,90');
    expect(formatBrlCents(0)).toBe('R$ 0,00');
    expect(formatBrlCents(123456)).toBe('R$ 1.234,56');
    expect(centsToInput(6990)).toBe('69,90');
  });

  it.each([
    ['69,90', 6990],
    ['69.90', 6990],
    ['R$ 69,90', 6990],
    ['1.234,56', 123456],
    ['1.234', 123400],
    ['1234', 123400],
    ['0,5', 50],
    ['7', 700],
  ])('lê "%s" como %i centavos', (text, cents) => {
    expect(parseBrlToCents(text)).toBe(cents);
  });

  it.each(['', '  ', 'abc', '-5', '1,234', '12,345,67', '1..5', 'R$'])(
    'recusa "%s"',
    (text) => {
      expect(parseBrlToCents(text)).toBeNull();
    },
  );
});

describe('período', () => {
  it('soma dias sobre o texto, sem deslocar pelo fuso', () => {
    expect(addDays('2026-10-07', -29)).toBe('2026-09-08');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysInRange('2026-09-08', '2026-10-07')).toBe(30);
    expect(daysInRange('2026-10-07', '2026-10-07')).toBe(1);
  });

  it('os atalhos terminam na âncora e se reconhecem', () => {
    expect(presetRange('2026-10-07', 7)).toEqual({
      from: '2026-10-01',
      to: '2026-10-07',
    });
    expect(
      presetOf({ from: '2026-07-10', to: '2026-10-07' }, '2026-10-07'),
    ).toBe(90);
    expect(
      presetOf({ from: '2026-09-01', to: '2026-10-07' }, '2026-10-07'),
    ).toBeNull();
    expect(
      presetOf({ from: '2026-10-01', to: '2026-10-06' }, '2026-10-07'),
    ).toBeNull();
  });

  it('recusa o que a API recusa: vazio, ao contrário e mais de 180 dias', () => {
    expect(rangeProblem('', '2026-10-07')).toBe('EMPTY');
    expect(rangeProblem('2026-10-08', '2026-10-07')).toBe('ORDER');
    // 180 dias contados passa; 181 não (a API recusa diferença de 180).
    expect(rangeProblem('2026-04-11', '2026-10-07')).toBeNull();
    expect(rangeProblem('2026-04-10', '2026-10-07')).toBe('TOO_LONG');
    expect(rangeProblem('2026-10-07', '2026-10-07')).toBeNull();
  });

  it('os limites do dia são do fuso de quem olha', () => {
    const bounds = localDayBounds('2026-10-07');
    const start = new Date(bounds.from);
    const end = new Date(bounds.to);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(7);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(7);
    expect(end.getHours()).toBe(23);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe('retenção por coorte', () => {
  const cohorts: Cohort[] = [
    {
      cohortWeek: '2026-09-21',
      size: 9,
      weeks: [
        { offset: 0, retained: 9, rate: 1 },
        { offset: 1, retained: 4, rate: 0.444 },
      ],
    },
    {
      cohortWeek: '2026-09-14',
      size: 12,
      weeks: [
        { offset: 0, retained: 12, rate: 1 },
        { offset: 1, retained: 6, rate: 0.5 },
        { offset: 2, retained: 1, rate: 0.083 },
      ],
    },
    {
      cohortWeek: '2026-09-28',
      size: 0,
      weeks: [{ offset: 0, retained: 0, rate: null }],
    },
  ];

  it('ordena por semana e deixa vazia a semana que ainda não aconteceu', () => {
    const matrix = buildRetentionMatrix(cohorts);

    expect(matrix.columns).toEqual([0, 1, 2]);
    expect(matrix.rows.map((row) => row.cohortWeek)).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(matrix.rows[1]?.cells[2]).toBeNull();
    expect(matrix.rows[0]?.cells[1]).toMatchObject({
      label: '50%',
      tone: 'high',
      retained: 6,
    });
  });

  it('o número vem escrito; coorte vazia vira traço', () => {
    expect(formatRate(0.444)).toBe('44%');
    expect(formatRate(null)).toBe('—');
    expect(buildRetentionMatrix(cohorts).rows[2]?.cells[0]).toMatchObject({
      label: '—',
      tone: 'none',
    });
  });

  it('faixas de tom', () => {
    expect(retentionTone(0.4)).toBe('high');
    expect(retentionTone(0.39)).toBe('mid');
    expect(retentionTone(0.2)).toBe('mid');
    expect(retentionTone(0.19)).toBe('low');
    expect(retentionTone(null)).toBe('none');
  });

  it('sem coorte, matriz vazia', () => {
    expect(buildRetentionMatrix([])).toEqual({ columns: [], rows: [] });
  });
});

describe('formulário de plano', () => {
  const plus: PlanView = {
    id: 'p1',
    tier: 'PLUS',
    billingPeriod: 'MONTHLY',
    priceCents: 6990,
    priceLabel: 'R$ 69,90 por mês',
    monthlyAiCredits: 500,
    active: true,
  };
  const free: PlanView = {
    ...plus,
    id: 'p0',
    tier: 'FREE',
    billingPeriod: null,
    priceCents: 0,
    monthlyAiCredits: 10,
  };

  it('sem mexer em nada, não há o que mandar', () => {
    expect(planPatch(plus, draftOf(plus))).toEqual({ patch: null, errors: {} });
  });

  it('manda só o que mudou, com o preço em centavos', () => {
    expect(planPatch(plus, { ...draftOf(plus), price: '79,90' }).patch).toEqual(
      { priceCents: 7990 },
    );
    expect(
      planPatch(plus, { price: '69,90', credits: '600', active: false }).patch,
    ).toEqual({ monthlyAiCredits: 600, active: false });
  });

  it('aponta o campo errado e não manda nada', () => {
    const bad = planPatch(plus, { price: 'abc', credits: '1,5', active: true });

    expect(bad.patch).toBeNull();
    expect(bad.errors).toEqual({
      price: 'PRICE_INVALID',
      credits: 'CREDITS_INVALID',
    });
    expect(
      planPatch(plus, { ...draftOf(plus), credits: '100001' }).errors,
    ).toEqual({ credits: 'CREDITS_TOO_BIG' });
    expect(
      planPatch(plus, { ...draftOf(plus), price: '100000,01' }).errors,
    ).toEqual({ price: 'PRICE_TOO_BIG' });
  });

  it('o gratuito não tem preço: o texto do preço é ignorado', () => {
    expect(
      planPatch(free, { price: 'qualquer', credits: '20', active: true }),
    ).toEqual({ patch: { monthlyAiCredits: 20 }, errors: {} });
  });
});

describe('formulário de bônus', () => {
  it('aceita quantidade e motivo, com espaços aparados', () => {
    expect(
      validateGrant({ amount: ' 25 ', reason: '  Compensação  ' }),
    ).toEqual({ value: { amount: 25, reason: 'Compensação' }, errors: {} });
  });

  it('o motivo é obrigatório', () => {
    expect(validateGrant({ amount: '5', reason: '   ' }).errors).toEqual({
      reason: 'REASON_REQUIRED',
    });
    expect(
      validateGrant({ amount: '5', reason: 'x'.repeat(201) }).errors,
    ).toEqual({ reason: 'REASON_TOO_LONG' });
  });

  it('quantidade: inteiro de 1 a 10 000', () => {
    for (const amount of ['', 'abc', '2,5', '-3']) {
      expect(validateGrant({ amount, reason: 'x' }).errors.amount).toBe(
        'AMOUNT_INVALID',
      );
    }
    for (const amount of ['0', '10001']) {
      expect(validateGrant({ amount, reason: 'x' }).errors.amount).toBe(
        'AMOUNT_OUT_OF_RANGE',
      );
    }
    expect(
      validateGrant({ amount: '10000', reason: 'x' }).value,
    ).not.toBeNull();
  });
});

describe('situação da conta', () => {
  it('anonimizada vale mais que exclusão pedida', () => {
    expect(studentStatus({ deletedAt: null, anonymizedAt: null })).toBe(
      'ACTIVE',
    );
    expect(studentStatus({ deletedAt: 'x', anonymizedAt: null })).toBe(
      'DELETED',
    );
    expect(studentStatus({ deletedAt: 'x', anonymizedAt: 'y' })).toBe(
      'ANONYMIZED',
    );
  });
});

describe('texto da auditoria', () => {
  const base: AuditEntry = {
    id: 'a',
    actorId: 'u',
    actorEmail: 'admin@exemplo.com',
    action: 'credits.bonus',
    targetType: 'user',
    targetId: 'x',
    details: {},
    requestId: null,
    createdAt: '2026-10-08T12:00:00.000Z',
    targetLabel: null,
  };

  it('bônus: quantidade, saldo depois e motivo', () => {
    expect(
      describeAudit({
        ...base,
        details: { amount: 25, reason: 'Compensação', balanceAfter: 35 },
      }),
    ).toEqual(['+25 créditos (saldo depois: 35) — motivo: Compensação']);
  });

  it('plano: nome e campo a campo, com preço em reais e sim/não', () => {
    expect(
      describeAudit({
        ...base,
        action: 'plan.update',
        details: {
          tier: 'PLUS',
          billingPeriod: 'MONTHLY',
          changes: {
            priceCents: { from: 6990, to: 7990 },
            monthlyAiCredits: { from: 500, to: 600 },
            active: { from: true, to: false },
          },
        },
      }),
    ).toEqual([
      'Plus mensal',
      'preço: R$ 69,90 → R$ 79,90',
      'cota mensal: 500 → 600',
      'à venda: sim → não',
    ]);
  });

  it('custo, métricas, ficha e ação desconhecida', () => {
    expect(
      describeAudit({
        ...base,
        action: 'credit-cost.update',
        details: { feature: 'TUTOR_ROLEPLAY', from: 3, to: 4 },
      }),
    ).toEqual(['Roleplay (por sessão): 3 → 4 créditos']);
    expect(
      describeAudit({
        ...base,
        action: 'metrics.rebuild',
        details: { from: '2026-09-01', to: '2026-09-03' },
      }),
    ).toEqual(['De 01/09/2026 até 03/09/2026']);
    expect(describeAudit({ ...base, action: 'student.view' })).toEqual([
      'Acesso a dados pessoais',
    ]);
    expect(describeAudit({ ...base, action: 'algo.novo' })).toEqual([]);
  });

  it('detalhe faltando não quebra', () => {
    expect(describeAudit({ ...base, details: {} })).toEqual([]);
    expect(
      describeAudit({
        ...base,
        action: 'plan.update',
        details: { tier: 'FREE' },
      }),
    ).toEqual(['Gratuito', 'Nenhum campo mudou.']);
  });
});
