import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { profileCalls, profileState } from '../../../mocks/profile-handlers';
import { server } from '../../../mocks/server';
import { API_URL, mockStudent, renderAppAt } from '../test-helpers';

const ENDPOINT = 'https://push.example.com/abc';

/**
 * Um navegador com Web Push: `Notification`, `PushManager` e um Service Worker
 * de mentira. Sem isto (o jsdom não tem nenhum dos três) a tela cai no
 * "este navegador não recebe avisos".
 */
function stubPushBrowser(options: {
  permission: NotificationPermission;
  /** O que o aluno responde ao pedido de permissão. */
  answer?: NotificationPermission;
}) {
  const subscription = {
    endpoint: ENDPOINT,
    toJSON: () => ({
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  let current: typeof subscription | null = null;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = subscription;
      return subscription;
    }),
  };
  const registration = { active: {}, pushManager };

  class FakeNotification {
    static permission: NotificationPermission = options.permission;
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = options.answer ?? 'granted';
      return FakeNotification.permission;
    });
  }

  vi.stubGlobal('Notification', FakeNotification);
  vi.stubGlobal('PushManager', class {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn(async () => registration),
      getRegistration: vi.fn(async () => (current ? registration : undefined)),
    },
  });

  return {
    requestPermission: FakeNotification.requestPermission,
    subscribe: pushManager.subscribe,
    unsubscribe: subscription.unsubscribe,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

async function openNotifications() {
  mockStudent();
  renderAppAt('/perfil/notificacoes');
  await screen.findByRole('heading', { name: 'Notificações' });
}

describe('Perfil → Notificações', () => {
  it('mostra os tipos, os canais e a hora que vale de fato', async () => {
    await openNotifications();

    expect(screen.getByRole('checkbox', { name: 'E-mail' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Lembrete diário' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Resumo semanal' }),
    ).toBeChecked();
    expect(screen.getByLabelText('Hora do lembrete')).toHaveValue('auto');
    expect(
      screen.getByRole('option', {
        name: 'Seguir o meu horário de estudo (19h)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Começa às')).toHaveValue('22');
    expect(screen.getByLabelText('Termina às')).toHaveValue('8');
  });

  it('cada interruptor salva ao mudar, só com o que mudou', async () => {
    await openNotifications();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Resumo semanal' }),
    );

    expect(await screen.findByText('Preferência salva.')).toBeInTheDocument();
    expect(profileCalls.preferencePatches).toEqual([
      { types: { weeklySummary: false } },
    ]);
    expect(profileState.preferences.types.weeklySummary).toBe(false);
    expect(
      screen.getByRole('checkbox', { name: 'Resumo semanal' }),
    ).not.toBeChecked();
  });

  it('com e-mail e navegador desligados, avisa que nada chega', async () => {
    await openNotifications();

    await userEvent.click(screen.getByRole('checkbox', { name: 'E-mail' }));

    expect(
      await screen.findByText(
        'Com e-mail e navegador desligados, você não recebe nenhum aviso.',
      ),
    ).toBeInTheDocument();
  });

  it('hora do lembrete dentro do silencioso é barrada antes do request', async () => {
    await openNotifications();

    await userEvent.selectOptions(
      screen.getByLabelText('Hora do lembrete'),
      '23',
    );

    expect(
      screen.getByText(/Essa hora cai no horário silencioso/),
    ).toBeInTheDocument();
    expect(profileCalls.preferencePatches).toEqual([]);

    await userEvent.selectOptions(
      screen.getByLabelText('Hora do lembrete'),
      '9',
    );

    expect(await screen.findByText('Preferência salva.')).toBeInTheDocument();
    expect(profileCalls.preferencePatches).toEqual([{ reminderHour: 9 }]);
    expect(
      screen.queryByText(/Essa hora cai no horário silencioso/),
    ).not.toBeInTheDocument();
  });

  it('a recusa 422 da API também aparece no campo, e a tela volta ao valor anterior', async () => {
    await openNotifications();
    server.use(
      http.patch(`${API_URL}/me/notifications/preferences`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'REMINDER_HOUR_IN_QUIET_TIME',
              message: 'Hora no silencioso.',
            },
          },
          { status: 422 },
        ),
      ),
    );

    await userEvent.selectOptions(
      screen.getByLabelText('Hora do lembrete'),
      '12',
    );

    expect(
      await screen.findByText(/Essa hora cai no horário silencioso/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Hora do lembrete')).toHaveValue('auto');
  });

  it('silencioso que engole a hora escolhida do lembrete é barrado', async () => {
    await openNotifications();
    await userEvent.selectOptions(
      screen.getByLabelText('Hora do lembrete'),
      '9',
    );
    await screen.findByText('Preferência salva.');

    await userEvent.selectOptions(screen.getByLabelText('Termina às'), '10');

    expect(
      screen.getByText(/O lembrete de 9h cairia dentro desse silencioso/),
    ).toBeInTheDocument();
    expect(profileCalls.preferencePatches).toHaveLength(1);
  });

  describe('avisos no navegador (push)', () => {
    it('não pede permissão ao abrir a tela — só no clique de ativar', async () => {
      const browser = stubPushBrowser({ permission: 'default' });
      await openNotifications();

      await screen.findByRole('button', {
        name: 'Ativar avisos no navegador',
      });
      expect(browser.requestPermission).not.toHaveBeenCalled();
    });

    it('ativar: pede permissão, assina e manda endpoint e chaves para a API', async () => {
      const browser = stubPushBrowser({ permission: 'default' });
      await openNotifications();

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Ativar avisos no navegador',
        }),
      );

      expect(
        await screen.findByText('Ativo em 1 dispositivo.'),
      ).toBeInTheDocument();
      expect(browser.requestPermission).toHaveBeenCalledTimes(1);
      expect(browser.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ userVisibleOnly: true }),
      );
      expect(profileCalls.pushSubscribes).toEqual([
        expect.objectContaining({
          endpoint: ENDPOINT,
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        }),
      ]);
      expect(profileState.preferences.channels.push).toBe(true);
      expect(
        screen.getByRole('button', { name: 'Enviar um aviso de teste' }),
      ).toBeInTheDocument();
    });

    it('permissão negada no pedido: explica e não registra nada na API', async () => {
      stubPushBrowser({ permission: 'default', answer: 'denied' });
      await openNotifications();

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Ativar avisos no navegador',
        }),
      );

      expect(
        await screen.findByText(/Você bloqueou os avisos neste navegador/),
      ).toBeInTheDocument();
      expect(profileCalls.pushSubscribes).toEqual([]);
      expect(
        screen.queryByRole('button', { name: 'Ativar avisos no navegador' }),
      ).not.toBeInTheDocument();
    });

    it('já bloqueado antes: o aviso fixo aparece sem nenhum clique', async () => {
      const browser = stubPushBrowser({ permission: 'denied' });
      await openNotifications();

      expect(
        await screen.findByText(/Você bloqueou os avisos neste navegador/),
      ).toBeInTheDocument();
      expect(browser.requestPermission).not.toHaveBeenCalled();
    });

    it('navegador sem suporte (ex.: iPhone fora do app instalado): explica, e o e-mail segue', async () => {
      await openNotifications();

      expect(
        await screen.findByText(/No iPhone, instale o site na tela inicial/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Ativar avisos no navegador' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'E-mail' })).toBeChecked();
    });

    it('servidor sem chaves VAPID: texto de indisponível, sem botão', async () => {
      stubPushBrowser({ permission: 'default' });
      mockStudent();
      profileState.preferences.push.available = false;
      renderAppAt('/perfil/notificacoes');

      expect(
        await screen.findByText(
          /Os avisos no navegador ainda não estão disponíveis/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Ativar avisos no navegador' }),
      ).not.toBeInTheDocument();
    });

    it('desativar: apaga a inscrição do navegador, na API, e desliga o canal', async () => {
      const browser = stubPushBrowser({ permission: 'default' });
      await openNotifications();
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Ativar avisos no navegador',
        }),
      );
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Desativar neste navegador',
        }),
      );

      expect(
        await screen.findByRole('button', {
          name: 'Ativar avisos no navegador',
        }),
      ).toBeInTheDocument();
      expect(browser.unsubscribe).toHaveBeenCalledTimes(1);
      expect(profileCalls.pushUnsubscribes).toEqual([{ endpoint: ENDPOINT }]);
      expect(profileCalls.preferencePatches).toContainEqual({
        channels: { push: false },
      });
      expect(profileState.preferences.channels.push).toBe(false);
      expect(profileState.preferences.push.devices).toBe(0);
    });

    it('aviso de teste chama a API e confirma na tela', async () => {
      stubPushBrowser({ permission: 'default' });
      await openNotifications();
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Ativar avisos no navegador',
        }),
      );

      await userEvent.click(
        await screen.findByRole('button', { name: 'Enviar um aviso de teste' }),
      );

      expect(
        await screen.findByText(/Enviamos um aviso de teste/),
      ).toBeInTheDocument();
      expect(profileCalls.pushTests).toBe(1);
    });
  });
});
