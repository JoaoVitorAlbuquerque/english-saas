export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  /** `Cache-Control` do objeto. Conteúdo base pode ser cacheado por muito tempo. */
  cacheControl?: string;
  /** Metadados livres, gravados como `x-amz-meta-*`. */
  metadata?: Record<string, string>;
};

export type PutObjectResult = {
  key: string;
  /** ETag devolvida pelo S3, útil para conferir integridade. */
  etag?: string;
};

export type SignedUrlOptions = {
  /** Validade em segundos. Sem valor, usa `S3_SIGNED_URL_TTL_SECONDS`. */
  expiresInSeconds?: number;
  /** Nome sugerido no download (`Content-Disposition: attachment`). */
  downloadFileName?: string;
};

/**
 * Contrato de armazenamento. Os módulos dependem desta classe abstrata, não
 * da implementação — trocar S3 por outro provedor não toca em ninguém.
 */
export abstract class StorageService {
  abstract putObject(input: PutObjectInput): Promise<PutObjectResult>;

  /** O conteúdo de um objeto, inteiro na memória. Para arquivo pequeno. */
  abstract getObject(key: string): Promise<Buffer>;

  /** URL temporária para um objeto privado. */
  abstract getSignedUrl(
    key: string,
    options?: SignedUrlOptions,
  ): Promise<string>;

  /** URL estável para objeto público (conteúdo base servido pelo CDN). */
  abstract getPublicUrl(key: string): string;

  abstract delete(key: string): Promise<void>;

  /** Usado pelo health check. */
  abstract ping(): Promise<void>;
}
