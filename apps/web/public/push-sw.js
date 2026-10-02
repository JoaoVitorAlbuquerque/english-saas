/* Service worker só de Web Push (ver `features/profile/lib/web-push.ts`).
 *
 * Fica num escopo próprio (`/push-sw/`) de propósito: não controla as páginas
 * e não faz cache de nada — só mostra o aviso e abre o app no clique.
 * O corpo do push é `{ title, body, url, type }`, montado pelo back-end. */

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Corpo que não é JSON: mostra um aviso genérico em vez de descartar.
    data = {};
  }

  // Só texto: o navegador mostra `title` e `body` como texto puro.
  const title =
    typeof data.title === 'string' && data.title !== ''
      ? data.title
      : 'english-saas';
  const body = typeof data.body === 'string' ? data.body : '';
  const url = typeof data.url === 'string' ? data.url : '/hoje';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      // Avisos do mesmo tipo trocam o anterior em vez de empilhar.
      tag: typeof data.type === 'string' ? data.type : undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Só caminho do próprio site: nunca navega para fora por causa do corpo do push.
  const target = new URL(
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/hoje',
    self.location.origin,
  );
  const url =
    target.origin === self.location.origin ? target.href : self.location.origin;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.navigate(url).then((navigated) => {
              return navigated ? navigated.focus() : client.focus();
            });
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
