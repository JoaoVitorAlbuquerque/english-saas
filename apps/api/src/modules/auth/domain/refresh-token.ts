/**
 * Regra de rotação do refresh token.
 *
 * Cada uso queima o token e emite outro na mesma **família**. Se um token já
 * rotacionado reaparecer, alguém está com uma cópia — revogamos a família
 * inteira e obrigamos o login de novo.
 *
 * Função pura: o relógio entra por parâmetro.
 */

export type StoredRefreshToken = {
  id: string;
  userId: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
};

export type RefreshDecision =
  | { action: 'rotate'; tokenId: string; userId: string; family: string }
  | { action: 'reject'; reason: RefreshRejectReason; family?: string };

export type RefreshRejectReason =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'REVOKED'
  /** Token já rotacionado reapareceu: indício de roubo. */
  | 'REUSED';

export const REFRESH_REJECT_MESSAGES: Record<RefreshRejectReason, string> = {
  NOT_FOUND: 'Sua sessão expirou. Entre de novo.',
  EXPIRED: 'Sua sessão expirou. Entre de novo.',
  REVOKED: 'Sua sessão foi encerrada. Entre de novo.',
  REUSED:
    'Detectamos um uso suspeito da sua sessão e encerramos todas por segurança. Entre de novo.',
};

/**
 * Decide o que fazer com o refresh token apresentado.
 *
 * `REUSED` vem antes de `REVOKED` de propósito: um token rotacionado fica
 * revogado **e** com `replacedById` preenchido, e queremos o motivo que
 * dispara a revogação da família.
 */
export function decideRefresh(
  stored: StoredRefreshToken | null,
  now: Date,
): RefreshDecision {
  if (stored === null) {
    return { action: 'reject', reason: 'NOT_FOUND' };
  }

  if (stored.replacedById !== null) {
    return { action: 'reject', reason: 'REUSED', family: stored.family };
  }

  if (stored.revokedAt !== null) {
    return { action: 'reject', reason: 'REVOKED', family: stored.family };
  }

  if (stored.expiresAt.getTime() <= now.getTime()) {
    return { action: 'reject', reason: 'EXPIRED', family: stored.family };
  }

  return {
    action: 'rotate',
    tokenId: stored.id,
    userId: stored.userId,
    family: stored.family,
  };
}

/** Vencimento do próximo refresh token. */
export function refreshTokenExpiresAt(now: Date, ttlDays: number): Date {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1_000);
}

/** Um token de uso único (verificar e-mail, resetar senha) ainda vale? */
export function isSingleUseTokenUsable(
  token: { expiresAt: Date; usedAt: Date | null } | null,
  now: Date,
): boolean {
  if (token === null || token.usedAt !== null) {
    return false;
  }

  return token.expiresAt.getTime() > now.getTime();
}
