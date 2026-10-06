/**
 * Acrescenta a query string ao caminho, descartando o que está vazio
 * (`undefined` e texto vazio). `false` fica: `includeDeprecated=false` é um
 * valor, não ausência.
 */
export function withQuery(
  path: string,
  query: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const text = params.toString();

  return text === '' ? path : `${path}?${text}`;
}
