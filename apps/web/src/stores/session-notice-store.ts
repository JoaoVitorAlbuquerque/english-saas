import { create } from 'zustand';

export type AccountDeletedNotice = {
  /** Instante (ISO) em que os dados pessoais são anonimizados. */
  anonymizeAt: string;
  daysRemaining: number;
};

type SessionNoticeState = {
  accountDeleted: AccountDeletedNotice | null;
  setAccountDeleted: (notice: AccountDeletedNotice) => void;
  clear: () => void;
};

/**
 * Aviso que precisa sobreviver ao fim da sessão: depois de excluir a conta, o
 * `AuthGuard` manda para `/login` por conta própria (sem `state` de
 * navegação), então o recado vai por aqui. Só em memória.
 */
export const useSessionNoticeStore = create<SessionNoticeState>((set) => ({
  accountDeleted: null,
  setAccountDeleted: (accountDeleted) => set({ accountDeleted }),
  clear: () => set({ accountDeleted: null }),
}));
