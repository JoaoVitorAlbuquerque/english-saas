import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';

const rootContainer = document.getElementById('root');

if (!rootContainer) {
  throw new Error('Elemento #root não encontrado.');
}

async function bootstrap(container: HTMLElement): Promise<void> {
  // Só o build do Playwright liga isto (`playwright.config.ts`); nunca em
  // produção. Import dinâmico para o `msw/browser` não entrar no bundle real.
  if (import.meta.env.VITE_E2E_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap(rootContainer);
