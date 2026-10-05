/**
 * Busca de texto sem acento e sem diferença de caixa.
 *
 * O banco só filtra `contains` com `insensitive`, que ainda distingue
 * "lição" de "licao". A taxonomia é pequena (centenas de linhas), então a
 * busca por texto filtra aqui, depois de ler.
 */

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Todos os termos da busca aparecem em algum dos campos. */
export function matchesSearch(
  fields: readonly string[],
  query: string,
): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = fields.map(normalizeSearch).join(' ');

  return terms.every((term) => haystack.includes(term));
}
