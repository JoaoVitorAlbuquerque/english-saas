export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

/**
 * Heurística só para orientar o aluno enquanto digita — quem decide de
 * verdade se a senha vale é o back-end (`checkPassword`, que devolve
 * `WEAK_PASSWORD` com a mensagem pronta se isso passar aqui e falhar lá).
 */
export function estimatePasswordStrength(
  password: string,
): PasswordStrengthScore {
  if (password.length === 0) {
    return 0;
  }

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(score, 4) as PasswordStrengthScore;
}
