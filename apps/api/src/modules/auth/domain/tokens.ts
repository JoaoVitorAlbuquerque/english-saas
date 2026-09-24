import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Tokens opacos: refresh, verificação de e-mail e reset de senha.
 *
 * O valor puro só existe no cookie ou no link do e-mail; no banco fica o
 * SHA-256. Vazou o banco, ninguém entra com o que está lá.
 *
 * SHA-256 e não bcrypt de propósito: são valores aleatórios de 256 bits, sem
 * entropia baixa para proteger, e a verificação precisa ser por lookup direto
 * do hash — com bcrypt seria uma varredura de tabela por tentativa.
 */

export const TOKEN_BYTES = 32;

export function generateOpaqueToken(bytes: number = TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação em tempo constante, para não vazar prefixo por timing. */
export function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

/** Vencimento de um token de uso único. */
export function expiresIn(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60 * 1_000);
}

export const EMAIL_VERIFICATION_TTL_MINUTES = 60 * 24;
export const PASSWORD_RESET_TTL_MINUTES = 30;
