import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // .env único na raiz do monorepo (ver "Ambiente local" no CLAUDE.md).
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react(), tailwindcss()],
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
  server: {
    port: 5174,
  },
});
