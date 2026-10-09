import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@english-saas/ui': fileURLToPath(
        new URL('../../packages/ui/src', import.meta.url),
      ),
      '@english-saas/api-client': fileURLToPath(
        new URL('../../packages/api-client/src', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setup-tests.ts'],
    css: false,
    // jsdom + digitação de formulário grande: sob carga (suíte inteira em
    // paralelo) 5 s é curto e gera falso negativo.
    testTimeout: 15_000,
    // Cada arquivo sobe jsdom + MSW; com todos os núcleos ocupados (e o turbo
    // rodando os outros pacotes ao lado) os `findBy` estouram e testes que
    // passam sozinhos falham, uma suíte diferente a cada rodada. 4 é estável.
    poolOptions: { forks: { minForks: 1, maxForks: 4 } },
    // e2e/ é Playwright, não Vitest — cada um fica no seu comando.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
