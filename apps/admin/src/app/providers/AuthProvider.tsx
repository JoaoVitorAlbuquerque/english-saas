import {
  refreshSession,
  subscribeApiClientEvents,
} from '@english-saas/api-client';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useAuthStore } from '../../stores/auth-store';

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
