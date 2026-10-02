import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '../../http/config';
import { clearAccessToken, setAccessToken } from '../../http/token-store';
import { applyPreferencesPatch } from './apply-patch';
import {
  getPreferences,
  subscribePush,
  unsubscribePush,
  updatePreferences,
} from './service';
import type { NotificationPreferences } from './schemas';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const preferences: NotificationPreferences = {
  types: { dailyReminder: true, reviewBacklog: true, weeklySummary: true },
  channels: { email: true, push: false },
  reminderHour: null,
  effectiveReminderHour: 19,
  quietHours: { start: 22, end: 8 },
  push: { available: true, devices: 0 },
};

beforeEach(() => {
  configureApiClient({ baseUrl: 'http://api.local' });
  setAccessToken('token-123');
});

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('preferências de notificação', () => {
  it('lê tipos, canais, hora efetiva e silencioso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(preferences)),
    );

    const result = await getPreferences();

    expect(result.effectiveReminderHour).toBe(19);
    expect(result.push.available).toBe(true);
  });

  it('PATCH leva só o que mudou', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(preferences));
    vi.stubGlobal('fetch', fetchMock);

    await updatePreferences({ types: { weeklySummary: false } });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/notifications/preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ types: { weeklySummary: false } }),
      }),
    );
  });

  it('recusa hora fora de 0–23 antes de chamar a API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(updatePreferences({ reminderHour: 24 })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('push', () => {
  it('registra o navegador com endpoint e chaves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...preferences,
        channels: { email: true, push: true },
        push: { available: true, devices: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await subscribePush({
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p256', auth: 'auth' },
      userAgent: 'Chrome',
    });

    expect(result.push.devices).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/notifications/push/subscriptions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('apagar a inscrição é um DELETE com o endpoint no corpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(preferences));
    vi.stubGlobal('fetch', fetchMock);

    await unsubscribePush({ endpoint: 'https://push.example.com/abc' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.local/me/notifications/push/subscriptions',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ endpoint: 'https://push.example.com/abc' }),
      }),
    );
  });
});

describe('applyPreferencesPatch', () => {
  it('muda só o que veio no patch', () => {
    const next = applyPreferencesPatch(preferences, {
      types: { weeklySummary: false },
      channels: { push: true },
    });

    expect(next.types).toEqual({
      dailyReminder: true,
      reviewBacklog: true,
      weeklySummary: false,
    });
    expect(next.channels).toEqual({ email: true, push: true });
    expect(next.quietHours).toEqual(preferences.quietHours);
  });

  it('reminderHour null volta a seguir o horário do perfil; ausente não mexe', () => {
    const chosen = { ...preferences, reminderHour: 9 };

    expect(
      applyPreferencesPatch(chosen, { reminderHour: null }).reminderHour,
    ).toBeNull();
    expect(applyPreferencesPatch(chosen, {}).reminderHour).toBe(9);
  });
});
