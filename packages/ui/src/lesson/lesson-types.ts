/**
 * Tipos estruturais das etapas de lição.
 *
 * As views deste diretório são só apresentação e **não importam o
 * api-client**: descrevem o que precisam. Quem chama (o player do aluno, o
 * preview do admin) passa dados que cabem nessas formas.
 */

export type LessonCharacter = {
  id: string;
  slug: string;
  name: string;
  /** Id do asset da imagem; a URL vem de `LessonAssets`. */
  avatarAssetId: string | null;
};

/** Mapa id do asset → URL já resolvida. */
export type LessonAssets = Record<string, { url: string }>;
