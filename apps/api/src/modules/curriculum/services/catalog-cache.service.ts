import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { RedisService } from 'src/infra/redis/redis.service';

/**
 * Cache do catálogo.
 *
 * O conteúdo base é igual para todo aluno e é lido o tempo todo, então vale
 * guardar montado. Duas regras:
 *
 * 1. **A versão entra na chave.** Publicar já invalida sozinho — não existe
 *    expurgo para dar errado, e a versão antiga expira por TTL.
 * 2. **Nada de URL assinada aqui dentro.** O que fica guardado é a
 *    `storageKey`; a URL é assinada na resposta, senão o cache entregaria
 *    link vencido para quem chegasse no fim do TTL.
 */
@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly envService: EnvService,
  ) {}

  lessonKey(slug: string, version: number): string {
    return `catalog:lesson:${slug}:v${String(version)}`;
  }

  listKey(name: string, scope = 'all'): string {
    return `catalog:list:${name}:${scope}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.client.get(key);

    if (raw === null) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn({ key }, 'Entrada de catálogo inválida — descartando');
      await this.redis.client.del(key);
      return undefined;
    }
  }

  async set(key: string, payload: unknown): Promise<void> {
    const ttl = this.envService.get('CATALOG_CACHE_TTL_SECONDS');

    if (ttl <= 0) {
      return;
    }

    await this.redis.client.set(key, JSON.stringify(payload), 'EX', ttl);
  }

  /**
   * Apaga as listagens.
   *
   * A lição não precisa disso (a versão está na chave), mas listagem de
   * nível e de unidade não tem número de versão para pendurar.
   */
  async invalidateLists(): Promise<void> {
    const keys = await this.redis.client.keys('catalog:list:*');

    if (keys.length > 0) {
      await this.redis.client.del(...keys);
    }
  }
}
