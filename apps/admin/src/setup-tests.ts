import '@testing-library/jest-dom/vitest';
import { configureApiClient } from '@english-saas/api-client';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetCurriculumMock } from './mocks/curriculum-mock';
import { resetStudioMock } from './mocks/studio-mock';
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

/**
 * O jsdom troca `FormData` e `File` pelos dele, e o `fetch` do Node não sabe
 * serializar o `FormData` do jsdom (manda texto, sem multipart). Num navegador
 * de verdade isso não existe; aqui o `fetch` monta o `multipart/form-data` na
 * mão, em bytes — só para o upload ser testável.
 */
function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function encodeMultipart(
  form: FormData,
  boundary: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') {
      chunks.push(
        encoder.encode(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
        ),
      );
    } else {
      chunks.push(
        encoder.encode(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${value.name}"\r\nContent-Type: ${value.type}\r\n\r\n`,
        ),
        await readBytes(value),
        encoder.encode('\r\n'),
      );
    }
  }

  chunks.push(encoder.encode(`--${boundary}--\r\n`));

  const body = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  return body;
}

function bridgeFormData(): void {
  // Depois do `server.listen`: o MSW troca o `fetch` ali, e a conversão precisa
  // acontecer antes de ele montar o `Request`.
  const mswFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    if (init?.body instanceof FormData) {
      const boundary = `----test-${Math.random().toString(16).slice(2)}`;

      return mswFetch(input, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: (await encodeMultipart(init.body, boundary)) as BodyInit,
      });
    }

    return mswFetch(input, init);
  };
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  bridgeFormData();
});
afterEach(() => {
  server.resetHandlers();
  resetCurriculumMock();
  resetStudioMock();
  cleanup();
});
afterAll(() => server.close());

// O jsdom não implementa mídia: `pause()`/`play()` imprimiriam "Not implemented"
// toda vez que um `AudioButton` desmonta.
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: () => undefined,
});
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
});
