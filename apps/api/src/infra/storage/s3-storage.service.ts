import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import {
  StorageService,
  type PutObjectInput,
  type PutObjectResult,
  type SignedUrlOptions,
} from './storage.service';
import { isValidStorageKey } from './storage-keys';

/**
 * Implementação S3. Funciona igual na AWS e no MinIO local — a diferença é
 * o `forcePathStyle`, que o MinIO exige (bucket no path, não no subdomínio).
 */
@Injectable()
export class S3StorageService
  extends StorageService
  implements OnModuleDestroy
{
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly envService: EnvService) {
    super();

    this.bucket = this.envService.get('S3_BUCKET');
    this.client = new S3Client({
      region: this.envService.get('S3_REGION'),
      endpoint: this.envService.get('S3_ENDPOINT'),
      forcePathStyle: this.envService.get('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: this.envService.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.envService.get('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    this.assertKey(input.key);

    const response = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ...(input.cacheControl ? { CacheControl: input.cacheControl } : {}),
        ...(input.metadata ? { Metadata: input.metadata } : {}),
      }),
    );

    this.logger.debug({ key: input.key }, 'Objeto gravado');

    return {
      key: input.key,
      ...(response.ETag ? { etag: response.ETag } : {}),
    };
  }

  async getSignedUrl(
    key: string,
    options: SignedUrlOptions = {},
  ): Promise<string> {
    this.assertKey(key);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options.downloadFileName
        ? {
            ResponseContentDisposition: `attachment; filename="${options.downloadFileName}"`,
          }
        : {}),
    });

    return getSignedUrl(this.client, command, {
      expiresIn:
        options.expiresInSeconds ??
        this.envService.get('S3_SIGNED_URL_TTL_SECONDS'),
    });
  }

  getPublicUrl(key: string): string {
    this.assertKey(key);

    const base =
      this.envService.get('S3_PUBLIC_URL') ??
      `${this.envService.get('S3_ENDPOINT')}/${this.bucket}`;

    return `${base.replace(/\/+$/, '')}/${key}`;
  }

  async getObject(key: string): Promise<Buffer> {
    this.assertKey(key);

    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (response.Body === undefined) {
      throw new Error(`Objeto vazio no storage: ${key}`);
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    this.assertKey(key);

    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    this.logger.debug({ key }, 'Objeto removido');
  }

  /** Confere que o bucket existe e que a credencial funciona. */
  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  private assertKey(key: string): void {
    if (!isValidStorageKey(key)) {
      throw new Error(
        `Chave de storage inválida: "${key}". Use buildStorageKey() com um dos prefixos conhecidos.`,
      );
    }
  }
}
