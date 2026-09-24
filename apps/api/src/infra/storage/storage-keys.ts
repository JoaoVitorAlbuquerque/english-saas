/**
 * Prefixos do bucket. Toda chave nasce de um deles — nada vai para a raiz.
 *
 * - `content/`   conteúdo base autorado por nós: áudio das cenas, imagens
 *                dos personagens, apostilas em PDF. Igual para todo aluno.
 * - `generated/` material que a IA produziu para um aluno específico.
 * - `uploads/`   arquivo enviado pelo aluno. Dado não confiável.
 * - `exports/`   arquivo que geramos para download: relatório, certificado.
 */
export const STORAGE_PREFIXES = {
  CONTENT: 'content',
  GENERATED: 'generated',
  UPLOADS: 'uploads',
  EXPORTS: 'exports',
} as const;

export type StoragePrefix =
  (typeof STORAGE_PREFIXES)[keyof typeof STORAGE_PREFIXES];

/** Marcas de acentuação, que somem depois do normalize('NFD'). */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Caracteres seguros numa chave S3, sem depender de encoding na URL. */
function sanitizeSegment(segment: string): string {
  return segment
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase();
}

/**
 * Monta uma chave dentro de um prefixo.
 *
 *   buildStorageKey(STORAGE_PREFIXES.CONTENT, 'lessons', lessonId, 'scene.mp3')
 *   → 'content/lessons/<id>/scene.mp3'
 */
export function buildStorageKey(
  prefix: StoragePrefix,
  ...segments: string[]
): string {
  const cleaned = segments
    .flatMap((segment) => segment.split('/'))
    .map(sanitizeSegment)
    .filter((segment) => segment.length > 0);

  if (cleaned.length === 0) {
    throw new Error('Uma chave de storage precisa de ao menos um segmento.');
  }

  return [prefix, ...cleaned].join('/');
}

/** Confere que a chave está sob um dos prefixos conhecidos. */
export function isValidStorageKey(key: string): boolean {
  const prefixes: string[] = Object.values(STORAGE_PREFIXES);
  const [prefix, ...rest] = key.split('/');

  return prefix !== undefined && prefixes.includes(prefix) && rest.length > 0;
}
