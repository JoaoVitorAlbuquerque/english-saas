import '@testing-library/jest-dom/vitest';
import { configureApiClient } from '@english-saas/api-client';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './mocks/server';

configureApiClient({ baseUrl: 'http://localhost:3333' });

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
