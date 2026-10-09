import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { listAuditLog } from './service';

const entry = {
  id: 'a1',
  actorId: 'u-admin',
  actorEmail: 'admin@exemplo.com',
  action: 'credits.bonus',
  targetType: 'user',
  targetId: 'u1',
  details: { amount: 25, reason: 'Compensação' },
  requestId: null,
  createdAt: '2026-10-07T12:00:00.000Z',
  targetLabel: 'ana@exemplo.com',
};

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

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('log de auditoria', () => {
  it('manda os filtros e ignora os vazios', async () => {
    const fetchMock = stubFetch({
      data: [entry],
      nextCursor: null,
      hasMore: false,
    });

    const page = await listAuditLog({
      action: 'credits.bonus',
      actorId: '',
      from: '2026-10-01T03:00:00.000Z',
      limit: 30,
    });

    expect(page.data[0]?.targetLabel).toBe('ana@exemplo.com');
    expect((fetchMock.mock.calls.at(-1) as [string])[0]).toBe(
      'http://api.local/admin/audit-log?action=credits.bonus&from=2026-10-01T03%3A00%3A00.000Z&limit=30',
    );
  });

  it('alvo que não é aluno chega sem rótulo', async () => {
    stubFetch({
      data: [{ ...entry, targetType: 'plan', targetLabel: null }],
      nextCursor: null,
      hasMore: false,
    });

    const page = await listAuditLog();

    expect(page.data[0]?.targetLabel).toBeNull();
  });
});
