import {
  AI_CREDIT_COSTS,
  balanceFrom,
  creditCycleKey,
  monthlyTopUp,
  remainingUses,
} from './domain/credits';
import {
  canAccessLesson,
  canUseFeature,
  ROLEPLAY_TURN_CAP,
  highestTier,
  type GuardableFeature,
  type PlanTier,
} from './domain/entitlements';
import { formatBrl, priceLabel } from './domain/pricing';
import {
  isUpgrade,
  MIN_CHARGE_CENTS,
  upgradeCreditCents,
} from './domain/proration';
import {
  addPeriod,
  applyPaymentEvent,
  effectiveTier,
  grantsAccess,
  planCacheTtlSeconds,
  subscriptionMessage,
  type SubscriptionView,
} from './domain/subscription-state';
import { parseAsaasWebhook } from './domain/webhook';

const NOW = new Date('2026-09-25T12:00:00.000Z');
const LATER = new Date('2026-10-25T12:00:00.000Z');

function sub(overrides: Partial<SubscriptionView> = {}): SubscriptionView {
  return {
    tier: 'PLUS',
    billingPeriod: 'MONTHLY',
    status: 'ACTIVE',
    currentPeriodEnd: LATER,
    ...overrides,
  };
}

describe('billing — entitlements por plano', () => {
  it('FREE vê só a primeira unidade de cada nível; BASE e PLUS, todas', () => {
    expect(canAccessLesson('FREE', { unitIndexInLevel: 0 })).toBe(true);
    expect(canAccessLesson('FREE', { unitIndexInLevel: 1 })).toBe(false);
    expect(canAccessLesson('BASE', { unitIndexInLevel: 7 })).toBe(true);
    expect(canAccessLesson('PLUS', { unitIndexInLevel: 7 })).toBe(true);
  });

  it.each<[PlanTier, GuardableFeature, boolean]>([
    ['FREE', 'TUTOR_CORRECTION', true],
    ['FREE', 'TUTOR_ROLEPLAY', true],
    ['FREE', 'GENERATOR_TOPIC', false],
    ['FREE', 'GENERATOR_INGEST', false],
    ['FREE', 'PDF_DOWNLOAD', false],
    ['BASE', 'TUTOR_CORRECTION', true],
    ['BASE', 'GENERATOR_TOPIC', false],
    ['BASE', 'GENERATOR_INGEST', false],
    ['BASE', 'PDF_DOWNLOAD', true],
    ['PLUS', 'GENERATOR_TOPIC', true],
    ['PLUS', 'GENERATOR_INGEST', true],
    ['PLUS', 'PDF_DOWNLOAD', true],
  ])('%s + %s = %s', (tier, feature, expected) => {
    expect(canUseFeature(tier, feature)).toBe(expected);
  });

  it('o maior tier ganha; lista vazia é FREE', () => {
    expect(highestTier([])).toBe('FREE');
    expect(highestTier(['BASE', 'PLUS', 'FREE'])).toBe('PLUS');
  });
});

describe('billing — acesso pela assinatura', () => {
  it('ACTIVE e PAST_DUE dão acesso; PENDING e EXPIRED não', () => {
    expect(grantsAccess(sub({ status: 'ACTIVE' }), NOW)).toBe(true);
    expect(grantsAccess(sub({ status: 'PAST_DUE' }), NOW)).toBe(true);
    expect(grantsAccess(sub({ status: 'PENDING' }), NOW)).toBe(false);
    expect(grantsAccess(sub({ status: 'EXPIRED' }), NOW)).toBe(false);
  });

  it('CANCELED mantém o plano até o fim do período pago, e só', () => {
    const canceled = sub({ status: 'CANCELED' });

    expect(effectiveTier([canceled], NOW)).toBe('PLUS');
    expect(effectiveTier([canceled], LATER)).toBe('FREE');
    expect(
      effectiveTier([sub({ status: 'CANCELED', currentPeriodEnd: null })], NOW),
    ).toBe('FREE');
  });

  it('sem assinatura é FREE; com várias, vale a maior que ainda dá acesso', () => {
    expect(effectiveTier([], NOW)).toBe('FREE');
    expect(
      effectiveTier(
        [sub({ tier: 'BASE' }), sub({ tier: 'PLUS', status: 'EXPIRED' })],
        NOW,
      ),
    ).toBe('BASE');
  });
});

describe('billing — transição por evento do gateway', () => {
  const due = new Date('2026-09-25T00:00:00.000Z');

  it('primeiro pagamento ativa e paga até o vencimento + um ciclo', () => {
    const next = applyPaymentEvent(
      sub({ status: 'PENDING', currentPeriodEnd: null }),
      {
        kind: 'PAYMENT_PAID',
        paymentDueDate: due,
      },
    );

    expect(next.status).toBe('ACTIVE');
    expect(next.activated).toBe(true);
    expect(next.currentPeriodEnd?.toISOString()).toBe(
      '2026-10-25T00:00:00.000Z',
    );
  });

  it('anual paga doze meses; renovação não é "ativação"', () => {
    const next = applyPaymentEvent(
      sub({ billingPeriod: 'YEARLY', currentPeriodEnd: due }),
      { kind: 'PAYMENT_PAID', paymentDueDate: due },
    );

    expect(next.activated).toBe(false);
    expect(next.currentPeriodEnd?.toISOString()).toBe(
      '2027-09-25T00:00:00.000Z',
    );
  });

  it('evento atrasado não encurta o período já pago', () => {
    const next = applyPaymentEvent(sub({ currentPeriodEnd: LATER }), {
      kind: 'PAYMENT_PAID',
      paymentDueDate: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(next.currentPeriodEnd).toEqual(LATER);
  });

  it('atraso leva ACTIVE a PAST_DUE e avisa; em PAST_DUE não repete', () => {
    const late = applyPaymentEvent(sub(), {
      kind: 'PAYMENT_OVERDUE',
      paymentDueDate: due,
    });
    expect(late).toMatchObject({ status: 'PAST_DUE', paymentFailed: true });

    const again = applyPaymentEvent(sub({ status: 'PAST_DUE' }), {
      kind: 'PAYMENT_OVERDUE',
      paymentDueDate: due,
    });
    expect(again.paymentFailed).toBe(false);
  });

  it('gateway encerrando expira — a não ser que o aluno já tenha cancelado', () => {
    expect(
      applyPaymentEvent(sub(), {
        kind: 'SUBSCRIPTION_ENDED',
        paymentDueDate: null,
      }),
    ).toMatchObject({ status: 'EXPIRED', expired: true });

    const canceled = applyPaymentEvent(sub({ status: 'CANCELED' }), {
      kind: 'SUBSCRIPTION_ENDED',
      paymentDueDate: null,
    });
    expect(canceled).toMatchObject({ status: 'CANCELED', expired: false });
    expect(canceled.currentPeriodEnd).toEqual(LATER);
  });

  it('pagamento depois do cancelamento não reabre a assinatura', () => {
    expect(
      applyPaymentEvent(sub({ status: 'CANCELED' }), {
        kind: 'PAYMENT_PAID',
        paymentDueDate: due,
      }).status,
    ).toBe('CANCELED');
  });

  it('somar um mês prende no último dia do mês curto', () => {
    expect(
      addPeriod(new Date('2026-01-31T00:00:00.000Z'), 'MONTHLY').toISOString(),
    ).toBe('2026-02-28T00:00:00.000Z');
    expect(
      addPeriod(new Date('2028-02-29T00:00:00.000Z'), 'YEARLY').toISOString(),
    ).toBe('2029-02-28T00:00:00.000Z');
  });
});

describe('billing — créditos', () => {
  it('saldo é a soma dos lançamentos', () => {
    // grant 100, consome 3 e 5, estorna o 5, bônus 10
    expect(
      balanceFrom([
        { amount: 100 },
        { amount: -3 },
        { amount: -5 },
        { amount: 5 },
        { amount: 10 },
      ]),
    ).toBe(107);
    expect(balanceFrom([])).toBe(0);
  });

  it('usos restantes arredondam para baixo e nunca ficam negativos', () => {
    expect(remainingUses(10, 'TUTOR_CORRECTION')).toBe(10);
    expect(remainingUses(10, 'TUTOR_ROLEPLAY')).toBe(3);
    expect(remainingUses(4, 'GENERATOR_TOPIC')).toBe(0);
    expect(remainingUses(-2, 'TUTOR_CORRECTION')).toBe(0);
  });

  it('custos do pedido: correção 1, roleplay 3, material por tema 5', () => {
    expect(AI_CREDIT_COSTS).toMatchObject({
      TUTOR_CORRECTION: 1,
      TUTOR_ROLEPLAY: 3,
      GENERATOR_TOPIC: 5,
    });
  });

  it('crédito do ciclo repõe até a cota, sem acumular acima dela', () => {
    expect(monthlyTopUp(0, 500)).toBe(500);
    expect(monthlyTopUp(120, 500)).toBe(380);
    expect(monthlyTopUp(700, 500)).toBe(0);
  });

  it('chave do ciclo separa tier e mês — assinar no meio do mês ainda credita', () => {
    expect(creditCycleKey('FREE', NOW)).toBe('FREE:2026-09');
    expect(creditCycleKey('PLUS', NOW)).toBe('PLUS:2026-09');
  });
});

describe('billing — preço e mensagem', () => {
  it('preço por extenso, com o equivalente mensal no anual', () => {
    expect(formatBrl(3_990)).toBe('R$ 39,90');
    expect(priceLabel(0, null)).toBe('Grátis');
    expect(priceLabel(6_990, 'MONTHLY')).toBe('R$ 69,90 por mês');
    expect(priceLabel(69_900, 'YEARLY')).toBe(
      'R$ 699,00 por ano (equivale a R$ 58,25 por mês)',
    );
  });

  it('cancelado diz até quando o acesso vai e que nada mais é cobrado', () => {
    const message = subscriptionMessage(
      { ...sub({ status: 'CANCELED' }), checkoutUrl: null },
      NOW,
    );

    expect(message).toContain('25/10/2026');
    expect(message).toContain('nada mais será cobrado');
  });
});

describe('billing — webhook do Asaas', () => {
  it('traduz pagamento confirmado, com a assinatura e o vencimento', () => {
    const event = parseAsaasWebhook({
      id: 'evt_1',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1', subscription: 'sub_1', dueDate: '2026-09-25' },
    });

    expect(event).toMatchObject({
      externalEventId: 'evt_1',
      kind: 'PAYMENT_PAID',
      externalSubscriptionId: 'sub_1',
    });
    expect(event?.paymentDueDate?.toISOString()).toBe(
      '2026-09-25T00:00:00.000Z',
    );
  });

  it('evento que não interessa passa com kind nulo; corpo inválido é null', () => {
    expect(
      parseAsaasWebhook({ id: 'evt_2', event: 'PAYMENT_CREATED' })?.kind,
    ).toBeNull();
    expect(parseAsaasWebhook({ foo: 'bar' })).toBeNull();
  });

  it('sem id, a mesma entrega gera o mesmo id — ainda deduplica', () => {
    const body = {
      event: 'PAYMENT_OVERDUE',
      payment: { subscription: 'sub_1' },
    };

    expect(parseAsaasWebhook(body)?.externalEventId).toBe(
      parseAsaasWebhook({ ...body })?.externalEventId,
    );
  });
});

describe('billing — upgrade com proporcional', () => {
  const end = new Date('2026-10-25T00:00:00.000Z');

  it('só é upgrade para tier maior, a partir de assinatura em dia', () => {
    expect(
      isUpgrade({
        currentTier: 'BASE',
        currentStatus: 'ACTIVE',
        targetTier: 'PLUS',
      }),
    ).toBe(true);
    expect(
      isUpgrade({
        currentTier: 'PLUS',
        currentStatus: 'ACTIVE',
        targetTier: 'BASE',
      }),
    ).toBe(false);
    expect(
      isUpgrade({
        currentTier: 'BASE',
        currentStatus: 'ACTIVE',
        targetTier: 'BASE',
      }),
    ).toBe(false);
    expect(
      isUpgrade({
        currentTier: 'BASE',
        currentStatus: 'PAST_DUE',
        targetTier: 'PLUS',
      }),
    ).toBe(false);
  });

  it('crédito proporcional ao que falta do ciclo', () => {
    // Ciclo de 25/09 a 25/10 (30 dias); faltam 15 dias do BASE de R$ 39,90.
    const credit = upgradeCreditCents({
      currentPriceCents: 3_990,
      currentPeriod: 'MONTHLY',
      currentPeriodEnd: end,
      newPriceCents: 6_990,
      now: new Date('2026-10-10T00:00:00.000Z'),
    });

    expect(credit).toBe(1_995);
  });

  it('sem período pago sobrando, não há crédito', () => {
    expect(
      upgradeCreditCents({
        currentPriceCents: 3_990,
        currentPeriod: 'MONTHLY',
        currentPeriodEnd: end,
        newPriceCents: 6_990,
        now: end,
      }),
    ).toBe(0);
    expect(
      upgradeCreditCents({
        currentPriceCents: 3_990,
        currentPeriod: 'MONTHLY',
        currentPeriodEnd: null,
        newPriceCents: 6_990,
        now: end,
      }),
    ).toBe(0);
  });

  it('o desconto nunca leva a cobrança abaixo do mínimo do gateway', () => {
    // Anual do BASE recém-pago (R$ 399) virando PLUS mensal (R$ 69,90).
    const credit = upgradeCreditCents({
      currentPriceCents: 39_900,
      currentPeriod: 'YEARLY',
      currentPeriodEnd: new Date('2027-09-25T00:00:00.000Z'),
      newPriceCents: 6_990,
      now: new Date('2026-09-26T00:00:00.000Z'),
    });

    expect(credit).toBe(6_990 - MIN_CHARGE_CENTS);
  });
});

describe('billing — cache do plano e limites', () => {
  const now = new Date('2026-09-25T12:00:00.000Z');

  it('cache não passa do fim de uma assinatura cancelada', () => {
    const canceled = {
      tier: 'PLUS' as const,
      billingPeriod: 'MONTHLY' as const,
      status: 'CANCELED' as const,
      currentPeriodEnd: new Date(now.getTime() + 90_000),
    };

    expect(planCacheTtlSeconds([canceled], now, 300)).toBe(90);
    expect(planCacheTtlSeconds([], now, 300)).toBe(300);
    expect(
      planCacheTtlSeconds([{ ...canceled, status: 'ACTIVE' }], now, 300),
    ).toBe(300);
  });

  it('roleplay: cenário livre só no Plus; teto de turnos cresce com o plano', () => {
    expect(canUseFeature('BASE', 'ROLEPLAY_FREE_SCENARIO')).toBe(false);
    expect(canUseFeature('PLUS', 'ROLEPLAY_FREE_SCENARIO')).toBe(true);
    expect(ROLEPLAY_TURN_CAP.FREE).toBeLessThan(ROLEPLAY_TURN_CAP.BASE);
    expect(ROLEPLAY_TURN_CAP.BASE).toBeLessThan(ROLEPLAY_TURN_CAP.PLUS);
  });
});
