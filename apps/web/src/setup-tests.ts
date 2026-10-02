import '@testing-library/jest-dom/vitest';
import { configureApiClient } from '@english-saas/api-client';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './mocks/server';

configureApiClient({ baseUrl: 'http://localhost:3333' });

// O padrão de 1 s do `findBy*` estoura na primeira renderização de uma tela
// quando os pacotes rodam em paralelo (`pnpm test`) e a máquina está carregada
// — sozinho, o mesmo teste passa. Só espera mais; teste que acha o elemento
// continua terminando na hora.
configure({ asyncUtilTimeout: 5_000 });

// jsdom não implementa ResizeObserver; alguns primitivos do Radix (Checkbox,
// Popover) o usam para medir tamanho no mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
