import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  cancelSubscription,
  checkout,
  getCredits,
  getCreditsHistory,
  getPlans,
  getSubscription,
} from './service';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('getPlans', () => {
  it('lista os planos sem exigir sessão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'plan-free',
          tier: 'FREE',
          billingPeriod: null,
          priceCents: 0,
          priceLabel: 'Grátis',
          monthlyAiCredits: 10,
          active: true,
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const plans = await getPlans();

    expect(plans[0]).toMatchObject({ tier: 'FREE', priceLabel: 'Grátis' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });
});

describe('checkout', () => {
  it('abre a assinatura em PENDING', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        tier: 'FREE',
        message: 'Falta só o pagamento.',
        subscription: {
          id: 'sub-1',
          tier: 'PLUS',
          billingPeriod: 'MONTHLY',
          status: 'PENDING',
          priceCents: 6_990,
          priceLabel: 'R$ 69,90 por mês',
          paymentMethod: 'PIX',
          checkoutUrl: null,
          currentPeriodEnd: null,
          accessUntil: null,
          canceledAt: null,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const overview = await checkout({
      tier: 'PLUS',
      billingPeriod: 'MONTHLY',
      paymentMethod: 'PIX',
      cpfCnpj: '12345678909',
    });

    expect(overview.subscription?.status).toBe('PENDING');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/billing/checkout',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('cancelSubscription', () => {
  it('cancela na hora', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        tier: 'PLUS',
        message: 'Assinatura cancelada.',
        subscription: {
          id: 'sub-1',
          tier: 'PLUS',
          billingPeriod: 'MONTHLY',
          status: 'CANCELED',
          priceCents: 6_990,
          priceLabel: 'R$ 69,90 por mês',
          paymentMethod: 'PIX',
          checkoutUrl: null,
          currentPeriodEnd: '2026-10-29T00:00:00.000Z',
          accessUntil: '2026-10-29T00:00:00.000Z',
          canceledAt: '2026-09-29T00:00:00.000Z',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const overview = await cancelSubscription();

    expect(overview.subscription?.status).toBe('CANCELED');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/billing/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('getSubscription', () => {
  it('busca o plano que vale agora', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        tier: 'FREE',
        message: 'Você está no plano Gratuito.',
        subscription: null,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const overview = await getSubscription();

    expect(overview.tier).toBe('FREE');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/subscription',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getCredits', () => {
  it('busca saldo e custos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        tier: 'FREE',
        balance: 10,
        monthlyAiCredits: 10,
        costs: { TUTOR_CORRECTION: 1, TUTOR_ROLEPLAY: 3 },
        nextGrantAt: '2026-10-01T00:05:00.000Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const credits = await getCredits();

    expect(credits.balance).toBe(10);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/credits',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('getCreditsHistory', () => {
  it('pagina o extrato, mais recente primeiro', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'entry-1',
            kind: 'CONSUME',
            amount: -3,
            feature: 'TUTOR_ROLEPLAY',
            reason: null,
            cycleKey: null,
            createdAt: '2026-09-29T00:00:00.000Z',
          },
        ],
        nextCursor: null,
        hasMore: false,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const page = await getCreditsHistory({ limit: 30 });

    expect(page.data[0]).toMatchObject({ kind: 'CONSUME', amount: -3 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/credits/history?limit=30',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
