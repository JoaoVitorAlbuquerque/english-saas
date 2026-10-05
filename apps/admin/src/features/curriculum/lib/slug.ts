/**
 * Sugere o identificador (slug) a partir do título: sem acento, minúsculas,
 * hífen no lugar de tudo que não é letra ou número. O padrão é o de
 * `contentSlugSchema` (`nice-to-meet-you`, `a1-u1-new-neighbors`).
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}
