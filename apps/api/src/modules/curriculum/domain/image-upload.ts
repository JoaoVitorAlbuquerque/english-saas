/**
 * Imagem enviada pelo editor (avatar de personagem, capa de unidade).
 *
 * O tipo vem dos primeiros bytes, não do nome do arquivo nem do
 * `Content-Type` — os dois são do cliente. Só JPEG, PNG e WebP, que tocam
 * em qualquer navegador.
 */

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type ImageType = { mimeType: string; extension: string };

const JPEG: ImageType = { mimeType: 'image/jpeg', extension: 'jpg' };
const PNG: ImageType = { mimeType: 'image/png', extension: 'png' };
const WEBP: ImageType = { mimeType: 'image/webp', extension: 'webp' };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Uint8Array, bytes: readonly number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

/** `null` quando não é uma das três. */
export function detectImageType(buffer: Uint8Array): ImageType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return JPEG;
  }

  if (startsWith(buffer, PNG_SIGNATURE)) {
    return PNG;
  }

  // RIFF....WEBP
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return WEBP;
  }

  return null;
}

export type ImageCheck =
  | { ok: true; type: ImageType }
  | { ok: false; reason: 'MISSING' | 'TOO_LARGE' | 'UNSUPPORTED_TYPE' };

export function checkImage(
  buffer: Uint8Array | undefined,
  maxBytes = IMAGE_MAX_BYTES,
): ImageCheck {
  if (buffer === undefined || buffer.byteLength === 0) {
    return { ok: false, reason: 'MISSING' };
  }

  if (buffer.byteLength > maxBytes) {
    return { ok: false, reason: 'TOO_LARGE' };
  }

  const type = detectImageType(buffer);

  return type === null
    ? { ok: false, reason: 'UNSUPPORTED_TYPE' }
    : { ok: true, type };
}
