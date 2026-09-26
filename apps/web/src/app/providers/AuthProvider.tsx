import {
  refreshSession,
  subscribeApiClientEvents,
} from '@english-saas/api-client';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useAuthStore } from '../../stores/auth-store';

/**
 * Tenta recuperar a sessão via cookie de refresh ao carregar o app (o access
 * token em memória some a cada reload) e escuta o evento global de logout
 * forçado (refresh falhou em alguma chamada durante o uso).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    refreshSession()
      .then((session) => setSession(session.user))
      .catch(() => clearSession());

    return subscribeApiClientEvents((event) => {
      if (event.type === 'unauthenticated') {
        clearSession();
      }
    });
  }, [setSession, clearSession]);

  return <>{children}</>;
}
