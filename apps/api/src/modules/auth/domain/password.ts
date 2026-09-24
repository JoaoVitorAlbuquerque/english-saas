/**
 * Política de senha.
 *
 * Função pura: recebe a senha e devolve os problemas, em pt-BR, prontos para
 * exibir ao aluno. Nada de "sua senha é fraca" sem dizer o porquê.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Senhas óbvias demais, recusadas mesmo quando passam nas outras regras. */
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  'senha123',
  'password',
  'password1',
  'qwertyui',
  'abc12345',
  'english1',
]);

export type PasswordProblem =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'NO_LETTER'
  | 'NO_NUMBER'
  | 'TOO_COMMON'
  | 'CONTAINS_EMAIL';

export const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  TOO_SHORT: `A senha precisa de pelo menos ${String(MIN_PASSWORD_LENGTH)} caracteres.`,
  TOO_LONG: `A senha pode ter no máximo ${String(MAX_PASSWORD_LENGTH)} caracteres.`,
  NO_LETTER: 'A senha precisa de pelo menos uma letra.',
  NO_NUMBER: 'A senha precisa de pelo menos um número.',
  TOO_COMMON: 'Essa senha é usada demais. Escolha outra.',
  CONTAINS_EMAIL: 'A senha não pode conter o seu e-mail.',
};

export type PasswordCheck = {
  valid: boolean;
  problems: PasswordProblem[];
  messages: string[];
};

export function checkPassword(
  password: string,
  options: { email?: string } = {},
): PasswordCheck {
  const problems: PasswordProblem[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push('TOO_SHORT');
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    problems.push('TOO_LONG');
  }

  if (!/\p{L}/u.test(password)) {
    problems.push('NO_LETTER');
  }

  if (!/\d/.test(password)) {
    problems.push('NO_NUMBER');
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push('TOO_COMMON');
  }

  const localPart = options.email?.split('@')[0]?.toLowerCase();

  if (
    localPart !== undefined &&
    localPart.length >= 3 &&
    password.toLowerCase().includes(localPart)
  ) {
    problems.push('CONTAINS_EMAIL');
  }

  return {
    valid: problems.length === 0,
    problems,
    messages: problems.map((problem) => PASSWORD_PROBLEM_MESSAGES[problem]),
  };
}

/** E-mail normalizado: é a chave única da conta, então tem que ser estável. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
