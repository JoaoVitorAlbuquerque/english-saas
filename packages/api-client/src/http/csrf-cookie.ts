const CSRF_COOKIE = 'csrf_token';

/**
 * Lê o cookie legível de CSRF direto do navegador — é o mesmo valor que o
 * back-end compara com o header `x-csrf-token` (double-submit cookie), então
 * não precisa ser guardado em nenhum estado à parte.
 */
export function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));

  return match?.slice(CSRF_COOKIE.length + 1);
}
