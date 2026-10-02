import type { PushSubscriptionRequest } from '@english-saas/api-client';

/**
 * Web Push no navegador. O service worker fica num **escopo próprio**
 * (`/push-sw/`): push só precisa de uma registration, não de controlar as
 * páginas, e assim não disputa o escopo `/` com o worker do MSW que o build
 * de e2e usa (um escopo só aceita um worker).
 */
export const PUSH_WORKER_URL = '/push-sw.js';
export const PUSH_WORKER_SCOPE = '/push-sw/';

/** Tudo que o fluxo toca no navegador, injetável para testar sem ele. */
export type PushEnvironment = {
  isSupported: () => boolean;
  permission: () => NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  /** Registra o worker e espera ele ficar ativo (o `subscribe` exige isso). */
  registerWorker: () => Promise<ServiceWorkerRegistration>;
  /** Este navegador já tem inscrição? Não registra nada nem pede permissão. */
  hasSubscription: () => Promise<boolean>;
  userAgent: string;
};

export type EnablePushResult =
  | { status: 'subscribed'; subscription: PushSubscriptionRequest }
  /** Sem Service Worker/Push/Notification (ex.: iPhone fora do PWA). */
  | { status: 'unsupported' }
  /** O aluno (ou o navegador) bloqueou os avisos. */
  | { status: 'denied' }
  /** Fechou o pedido de permissão sem escolher. */
  | { status: 'dismissed' };

/** A chave VAPID chega em base64url; o `subscribe` quer bytes. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);

  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/**
 * Pede permissão **e** assina o push, nesta ordem. Só pode ser chamada de um
 * clique do aluno: é aqui que o navegador mostra o pedido de permissão.
 * `getPublicKey` só roda depois da permissão — sem ela não há o que assinar.
 */
export async function enablePush(
  env: PushEnvironment,
  getPublicKey: () => Promise<string>,
): Promise<EnablePushResult> {
  if (!env.isSupported()) {
    return { status: 'unsupported' };
  }

  let permission = env.permission();

  if (permission === 'default') {
    permission = await env.requestPermission();
  }

  if (permission === 'denied') {
    return { status: 'denied' };
  }

  if (permission !== 'granted') {
    return { status: 'dismissed' };
  }

  const registration = await env.registerWorker();
  // Já assinado neste navegador (ligou, desligou no servidor, ligou de novo):
  // reaproveita a inscrição em vez de criar outra.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        await getPublicKey(),
      ) as BufferSource,
    }));

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (
    json.endpoint === undefined ||
    p256dh === undefined ||
    auth === undefined
  ) {
    throw new Error('A inscrição de push veio sem as chaves.');
  }

  return {
    status: 'subscribed',
    subscription: {
      endpoint: json.endpoint,
      keys: { p256dh, auth },
      userAgent: env.userAgent.slice(0, 300),
    },
  };
}

/**
 * Cancela a inscrição **deste navegador** e devolve o endpoint, para o
 * servidor apagá-la também. `null` = este navegador nunca assinou.
 */
export async function disablePush(
  env: PushEnvironment,
): Promise<string | null> {
  if (!env.isSupported()) {
    return null;
  }

  const registration = await env.registerWorker();
  const subscription = await registration.pushManager.getSubscription();

  if (subscription === null) {
    return null;
  }

  const { endpoint } = subscription;
  await subscription.unsubscribe();

  return endpoint;
}

/** O ambiente real. Só existe no navegador — o teste passa um fake. */
export function browserPushEnvironment(): PushEnvironment {
  return {
    isSupported: () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
    permission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission(),
    registerWorker: async () => {
      const registration = await navigator.serviceWorker.register(
        PUSH_WORKER_URL,
        { scope: PUSH_WORKER_SCOPE },
      );

      return waitForActive(registration);
    },
    hasSubscription: async () => {
      // `getRegistration` só olha: se o aluno nunca ativou, não há worker.
      const registration =
        await navigator.serviceWorker.getRegistration(PUSH_WORKER_SCOPE);
      const subscription = await registration?.pushManager.getSubscription();

      return subscription !== null && subscription !== undefined;
    },
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  };
}

function waitForActive(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (registration.active !== null) {
    return Promise.resolve(registration);
  }

  const worker = registration.installing ?? registration.waiting;

  if (worker === null) {
    return Promise.reject(new Error('O worker de push não iniciou.'));
  }

  return new Promise((resolve, reject) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        resolve(registration);
      } else if (worker.state === 'redundant') {
        reject(new Error('O worker de push não pôde ser ativado.'));
      }
    });
  });
}
