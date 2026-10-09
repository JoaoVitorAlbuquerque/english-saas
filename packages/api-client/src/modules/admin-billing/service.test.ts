import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import {
  getCreditCosts,
  grantBonus,
  listPlans,
  updateCreditCost,
  updatePlan,
} from './service';

const PLAN = '11111111-1111-4111-8111-111111111111';

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];

  return {
    url,
    method: init.method,
    body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

const planFixture = {
  id: PLAN,
  tier: 'PLUS',
  billingPeriod: 'MONTHLY',
  priceCents: 6990,
  priceLabel: 'R$ 69,90 por mês',
  monthlyAiCredits: 500,
  active: true,
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('planos', () => {
  it('lista todos, inclusive os fora de venda', async () => {
    const fetchMock = stubFetch([planFixture]);

    await expect(listPlans()).resolves.toHaveLength(1);
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/billing/plans',
    );
  });

  it('PATCH leva só os campos informados', async () => {
    const fetchMock = stubFetch({ ...planFixture, priceCents: 7990 });

    await updatePlan(PLAN, { priceCents: 7990 });

    const request = lastRequest(fetchMock);
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe(`http://api.local/admin/billing/plans/${PLAN}`);
    expect(request.body).toEqual({ priceCents: 7990 });
  });

  it('recusa no cliente o corpo vazio e o preço negativo', async () => {
    const fetchMock = stubFetch(planFixture);

    await expect(updatePlan(PLAN, {})).rejects.toThrow();
    await expect(updatePlan(PLAN, { priceCents: -1 })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('custo dos créditos', () => {
  it('lê e atualiza uma feature por vez', async () => {
    const fetchMock = stubFetch({ costs: { TUTOR_ROLEPLAY: 4 } });

    await getCreditCosts();
    expect(lastRequest(fetchMock).url).toBe(
      'http://api.local/admin/billing/credit-costs',
    );

    await expect(updateCreditCost('TUTOR_ROLEPLAY', 4)).resolves.toEqual({
      costs: { TUTOR_ROLEPLAY: 4 },
    });
    const request = lastRequest(fetchMock);
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe(
      'http://api.local/admin/billing/credit-costs/TUTOR_ROLEPLAY',
    );
    expect(request.body).toEqual({ cost: 4 });
  });
});

describe('bônus', () => {
  it('manda quantidade e motivo e devolve o saldo novo', async () => {
    const fetchMock = stubFetch({ balance: 35 });

    await expect(
      grantBonus('user-1', { amount: 25, reason: 'Compensação' }),
    ).resolves.toEqual({ balance: 35 });

    const request = lastRequest(fetchMock);
    expect(request.method).toBe('POST');
    expect(request.url).toBe(
      'http://api.local/admin/billing/users/user-1/credits/bonus',
    );
    expect(request.body).toEqual({ amount: 25, reason: 'Compensação' });
  });

  it('recusa no cliente motivo vazio e quantidade fora do limite', async () => {
    const fetchMock = stubFetch({ balance: 1 });

    await expect(
      grantBonus('u', { amount: 5, reason: '  ' }),
    ).rejects.toThrow();
    await expect(grantBonus('u', { amount: 0, reason: 'x' })).rejects.toThrow();
    await expect(
      grantBonus('u', { amount: 10_001, reason: 'x' }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
