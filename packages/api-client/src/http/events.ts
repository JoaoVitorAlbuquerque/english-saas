import type { ApiError } from './api-error';

export type ApiClientEvent =
  | { type: 'unauthenticated' }
  | { type: 'plan-required'; requiredPlan?: string; error: ApiError }
  | { type: 'insufficient-credits'; error: ApiError };

type Listener = (event: ApiClientEvent) => void;

const listeners = new Set<Listener>();

/**
 * Barramento simples para os efeitos globais de erro de API. Cada app decide
 * o que fazer (redirecionar para /login, abrir paywall, mostrar toast) — o
 * api-client não conhece UI.
 */
export function subscribeApiClientEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitApiClientEvent(event: ApiClientEvent): void {
  listeners.forEach((listener) => listener(event));
}
