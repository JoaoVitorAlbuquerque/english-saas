import type { SessionUser } from '@english-saas/api-client';
import { create } from 'zustand';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: SessionUser | null;
  setSession: (user: SessionUser) => void;
  clearSession: () => void;
};

/**
 * Estado de sessão para a UI (usuário, status). O access token em si mora só
 * no `token-store` do api-client — este store nunca guarda o token.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  user: null,
  setSession: (user) => set({ status: 'authenticated', user }),
  clearSession: () => set({ status: 'unauthenticated', user: null }),
}));
