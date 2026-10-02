import {
  ApiError,
  usePushPublicKey,
  useSubscribePush,
  useTestPush,
  useUnsubscribePush,
  useUpdateNotificationPreferences,
  type NotificationPreferences,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useEffect, useState } from 'react';

import { t } from '../../../messages/pt-BR';
import {
  browserPushEnvironment,
  disablePush,
  enablePush,
} from '../lib/web-push';

/** O que a seção de push mostra — um estado por vez, em ordem de prioridade. */
export type PushView =
  'unavailable' | 'unsupported' | 'denied' | 'active' | 'inactive';

export type PushNotice =
  'denied' | 'dismissed' | 'unavailable' | 'unsupported' | 'error';

const NOTICE_MESSAGES = {
  denied: 'profile.push.denied',
  dismissed: 'profile.push.dismissed',
  unavailable: 'profile.push.unavailable',
  unsupported: 'profile.push.unsupported',
  error: 'profile.push.error',
} as const;

/**
 * Ativar e desativar o Web Push. A permissão do navegador só é pedida dentro
 * de `enable` — que roda no clique do aluno, nunca ao abrir a tela.
 */
export function usePushController(preferences: NotificationPreferences) {
  const publicKey = usePushPublicKey();
  const subscribe = useSubscribePush();
  const unsubscribe = useUnsubscribePush();
  const updatePreferences = useUpdateNotificationPreferences();
  const testPush = useTestPush();

  const [notice, setNotice] = useState<PushNotice | null>(null);
  const [subscribedHere, setSubscribedHere] = useState(false);
  const [isBusy, setBusy] = useState(false);

  const environment = browserPushEnvironment();
  const isSupported = environment.isSupported();
  const permission = isSupported ? Notification.permission : null;

  useEffect(() => {
    let isCurrent = true;

    if (isSupported) {
      void environment.hasSubscription().then((has) => {
        if (isCurrent) {
          setSubscribedHere(has);
        }
      });
    }

    return () => {
      isCurrent = false;
    };
    // `environment` é recriado a cada render; só `isSupported` importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  let view: PushView = 'inactive';
  if (!preferences.push.available) {
    view = 'unavailable';
  } else if (!isSupported) {
    view = 'unsupported';
  } else if (subscribedHere && preferences.channels.push) {
    view = 'active';
  } else if (permission === 'denied') {
    view = 'denied';
  }

  async function enable() {
    setNotice(null);
    setBusy(true);

    try {
      const result = await enablePush(
        environment,
        async () => (await publicKey.mutateAsync()).publicKey,
      );

      if (result.status === 'subscribed') {
        await subscribe.mutateAsync(result.subscription);
        setSubscribedHere(true);
      } else {
        setNotice(result.status);
      }
    } catch (error) {
      setNotice(
        error instanceof ApiError && error.code === 'PUSH_UNAVAILABLE'
          ? 'unavailable'
          : 'error',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setNotice(null);
    setBusy(true);

    try {
      const endpoint = await disablePush(environment);

      if (endpoint !== null) {
        await unsubscribe.mutateAsync({ endpoint });
      }

      // Apagar a inscrição não desliga o canal: quem desliga é a preferência.
      await updatePreferences.mutateAsync({ channels: { push: false } });
      setSubscribedHere(false);
    } catch {
      setNotice('error');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    try {
      const { delivered } = await testPush.mutateAsync();

      if (delivered) {
        toast.success({ title: t('profile.push.testSent') });
      } else {
        toast.error({ title: t('profile.push.testNotDelivered') });
      }
    } catch {
      toast.error({ title: t('profile.push.testNotDelivered') });
    }
  }

  return {
    view,
    devices: preferences.push.devices,
    /** O recado fixo dos estados em que não dá para ativar. */
    blockedMessage:
      view === 'unavailable' || view === 'unsupported' || view === 'denied'
        ? t(NOTICE_MESSAGES[view])
        : null,
    /** O recado do último clique; não repete o fixo (`denied` já aparece nele). */
    noticeMessage:
      notice === null || notice === view ? null : t(NOTICE_MESSAGES[notice]),
    isBusy,
    isTesting: testPush.isPending,
    enable: () => void enable(),
    disable: () => void disable(),
    sendTest: () => void sendTest(),
  };
}
