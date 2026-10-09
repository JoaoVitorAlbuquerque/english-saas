import type { SessionUser } from '@english-saas/api-client';
import { create } from 'zustand';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: SessionUser | null;
  setSession: (user: SessionUser) => void;
  clearSession: () => void;
};

const ALLOWED_ROLES: SessionUser['role'][] = ['EDITOR', 'ADMIN'];

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  user: null,
  setSession: (user) => set({ status: 'authenticated', user }),
  clearSession: () => set({ status: 'unauthenticated', user: null }),
}));

export function hasAdminAccess(user: SessionUser | null): boolean {
  return user !== null && ALLOWED_ROLES.includes(user.role);
}

/** Gestão (alunos, planos, métricas, auditoria) é só do administrador. */
export function isAdmin(user: SessionUser | null): boolean {
  return user !== null && user.role === 'ADMIN';
}
