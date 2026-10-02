/** Minúsculas, sem acento, sem espaço nas pontas — serve para buscar e comparar. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * O tema vai para a API como slug (`^[a-z0-9][a-z0-9-]*$`, 2 a 40 letras):
 * "Copa do Mundo" vira `copa-do-mundo`. Tema que não vira slug válido
 * (só símbolos, curto demais) devolve `null`.
 */
export function toTopicSlug(text: string): string | null {
  const slug = normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

  return slug.length >= 2 ? slug : null;
}
