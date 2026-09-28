import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Liga o worker do MSW no build servido ao Playwright — nunca em
    // produção de verdade (ver `src/main.tsx` e `src/mocks/browser.ts`).
    env: { VITE_E2E_MOCKS: 'true' },
  },
});
