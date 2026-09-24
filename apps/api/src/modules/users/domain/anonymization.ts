import { ANONYMIZATION_GRACE_DAYS } from '@english-saas/shared';

/**
 * Exclusão de conta em duas etapas (LGPD).
 *
 * 1. O aluno pede: soft delete imediato — ele perde o acesso na hora.
 * 2. Passados 30 dias, o job anonimiza de vez. A janela existe para o aluno
 *    poder se arrepender e para atendermos obrigação legal de guarda.
 *
 * Funções puras: o relógio entra por parâmetro.
 */

export type DeletableUser = {
  id: string;
  deletedAt: Date | null;
  anonymizedAt: Date | null;
};

/** A carência já venceu e o usuário ainda não foi anonimizado? */
export function isDueForAnonymization(
  user: DeletableUser,
  now: Date,
  graceDays: number = ANONYMIZATION_GRACE_DAYS,
): boolean {
  if (user.deletedAt === null || user.anonymizedAt !== null) {
    return false;
  }

  return (
    now.getTime() >= anonymizationDueAt(user.deletedAt, graceDays).getTime()
  );
}

export function anonymizationDueAt(
  deletedAt: Date,
  graceDays: number = ANONYMIZATION_GRACE_DAYS,
): Date {
  return new Date(deletedAt.getTime() + graceDays * 24 * 60 * 60 * 1_000);
}

/** Quantos dias faltam para a anonimização. 0 quando já venceu. */
export function daysUntilAnonymization(
  deletedAt: Date,
  now: Date,
  graceDays: number = ANONYMIZATION_GRACE_DAYS,
): number {
  const remainingMs =
    anonymizationDueAt(deletedAt, graceDays).getTime() - now.getTime();

  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1_000)));
}

export type AnonymizedUserFields = {
  email: string;
  name: string;
  passwordHash: null;
  anonymizedAt: Date;
};

/**
 * Como a linha do usuário fica depois de anonimizada.
 *
 * A linha não some: o histórico de uso e de cobrança precisa continuar
 * fechando. O que some é tudo que identifica a pessoa. O e-mail vira um
 * placeholder derivado do id, que continua único sem dizer nada.
 */
export function buildAnonymizedUser(
  userId: string,
  now: Date,
): AnonymizedUserFields {
  return {
    email: `anonymized+${userId}@deleted.invalid`,
    name: 'Conta removida',
    passwordHash: null,
    anonymizedAt: now,
  };
}
