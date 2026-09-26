/**
 * Access token em memória — nunca em localStorage/sessionStorage. Some ao
 * recarregar a página de propósito; quem recupera a sessão é o refresh
 * (cookie httpOnly), disparado pelo `AuthProvider` de cada app.
 */
let accessToken: string | null = null;
const listeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(next: string | null): void {
  accessToken = next;
  listeners.forEach((listener) => listener());
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

export function subscribeAccessToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
