import '@testing-library/jest-dom/vitest';
import { configureApiClient } from '@english-saas/api-client';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './mocks/server';

configureApiClient({ baseUrl: 'http://localhost:3333' });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
