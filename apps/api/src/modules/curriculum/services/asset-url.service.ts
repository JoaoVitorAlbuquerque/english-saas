import { Injectable } from '@nestjs/common';
import type { MediaKind } from '@prisma/client';

import { EnvService } from 'src/common/config/env.service';
import { StorageService } from 'src/infra/storage/storage.service';

export type AssetRow = {
  id: string;
  kind: MediaKind;
  storageKey: string;
  mimeType: string;
  durationMs: number | null;
};

export type ResolvedAsset = {
  id: string;
  kind: MediaKind;
  mimeType: string;
  durationMs: number | null;
  /** URL temporária. Nunca é cacheada — ver CatalogCacheService. */
  url: string;
};

/**
 * Transforma `storageKey` em URL no momento da resposta.
 *
 * A assinatura vence, então ela não pode entrar em cache junto com o
 * conteúdo: o cache guarda a chave, e a URL nasce aqui, a cada requisição.
 */
@Injectable()
export class AssetUrlService {
  constructor(
    private readonly storage: StorageService,
    private readonly envService: EnvService,
  ) {}

  private get ttlSeconds(): number {
    return this.envService.get('CONTENT_URL_TTL_SECONDS');
  }

  async resolve(asset: AssetRow): Promise<ResolvedAsset> {
    const [resolved] = await this.resolveMany([asset]);

    // `resolveMany` devolve um para um; o fallback é só para o tipo.
    return (
      resolved ?? {
        id: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        durationMs: asset.durationMs,
        url: '',
      }
    );
  }

  async resolveMany(assets: readonly AssetRow[]): Promise<ResolvedAsset[]> {
    const expiresInSeconds = this.ttlSeconds;

    return Promise.all(
      assets.map(async (asset) => ({
        id: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        durationMs: asset.durationMs,
        url: await this.storage.getSignedUrl(asset.storageKey, {
          expiresInSeconds,
        }),
      })),
    );
  }

  /** Mapa id → asset resolvido, que é como o catálogo entrega. */
  async resolveMap(
    assets: readonly AssetRow[],
  ): Promise<Record<string, ResolvedAsset>> {
    const resolved = await this.resolveMany(assets);

    return Object.fromEntries(resolved.map((asset) => [asset.id, asset]));
  }
}
