/**
 * Extração do texto de uma página HTML com jsdom + Readability.
 *
 * **jsdom fica na 26.** A 27+ depende de pacote ESM puro
 * (`@exodus/bytes`), e o Jest em CommonJS não carrega — mesma armadilha do
 * `@nestjs/event-emitter` 12 (ver CLAUDE.md). Carregado sob demanda: só
 * quem busca uma URL paga o custo de subir o jsdom.
 */

export type ExtractedArticle = { title: string | null; text: string };

/** O miolo da página (sem menu, rodapé nem anúncio), em texto puro. */
export async function extractArticle(
  html: string,
  url: string,
): Promise<ExtractedArticle> {
  const [{ JSDOM }, { Readability }] = await Promise.all([
    import('jsdom'),
    import('@mozilla/readability'),
  ]);
  // Sem scripts nem recursos externos: o JSDOM só monta a árvore.
  const dom = new JSDOM(html, { url });

  try {
    const article = new Readability(dom.window.document).parse();
    return {
      title: article?.title ?? null,
      text: article?.textContent ?? '',
    };
  } finally {
    dom.window.close();
  }
}
