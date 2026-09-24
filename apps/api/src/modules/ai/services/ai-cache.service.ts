import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';

import { buildAiCacheKey } from '../domain/cache-key';

export type AiCacheLookup = {
  promptId: string;
  promptVersion: number;
  model: string;
  input: unknown;
};

/**
 * Cache de resultados de IA em duas camadas.
 *
 * - **Redis**: camada quente, respondida em microssegundos.
 * - **`ai_cache_entries`**: camada durável, sobrevive a um flush do Redis e
 *   permite que o resultado caro de um aluno sirva para outro.
 *
 * Só guarda saída **já validada** pelo zod do prompt.
 */
@Injectable()
export class AiCacheService {
  private readonly logger = new Logger(AiCacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  buildKey(lookup: AiCacheLookup): string {
    return buildAiCacheKey(lookup);
  }

  async get<TOutput>(key: string): Promise<TOutput | undefined> {
    const hot = await this.readFromRedis<TOutput>(key);

    if (hot !== undefined) {
      return hot;
    }

    const entry = await this.prisma.aiCacheEntry.findUnique({
      where: { cacheKey: key },
    });

    if (entry === null || entry.expiresAt.getTime() <= Date.now()) {
      return undefined;
    }

    // Repovoa o Redis com o que sobrou de validade.
    const ttlSeconds = Math.floor(
      (entry.expiresAt.getTime() - Date.now()) / 1_000,
    );

    if (ttlSeconds > 0) {
      await this.redis.client.set(
        key,
        JSON.stringify(entry.payload),
        'EX',
        ttlSeconds,
      );
    }

    await this.prisma.aiCacheEntry.update({
      where: { cacheKey: key },
      data: { hits: { increment: 1 } },
    });

    return entry.payload as TOutput;
  }

  async set(
    key: string,
    lookup: AiCacheLookup,
    payload: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.envService.get('AI_CACHE_TTL_SECONDS');

    if (ttl <= 0) {
      return;
    }

    const expiresAt = new Date(Date.now() + ttl * 1_000);
    const serialized = JSON.stringify(payload);

    await this.redis.client.set(key, serialized, 'EX', ttl);

    await this.prisma.aiCacheEntry.upsert({
      where: { cacheKey: key },
      create: {
        cacheKey: key,
        promptId: lookup.promptId,
        promptVersion: lookup.promptVersion,
        model: lookup.model,
        payload: payload as never,
        expiresAt,
      },
      update: { payload: payload as never, expiresAt },
    });
  }

  /** Remove entradas vencidas. Chamado por job agendado no futuro. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.aiCacheEntry.deleteMany({
      where: { expiresAt: { lte: now } },
    });

    return count;
  }

  private async readFromRedis<TOutput>(
    key: string,
  ): Promise<TOutput | undefined> {
    const raw = await this.redis.client.get(key);

    if (raw === null) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as TOutput;
    } catch {
      // Entrada corrompida não pode derrubar a chamada: trata como miss.
      this.logger.warn({ key }, 'Entrada de cache inválida — descartando');
      await this.redis.client.del(key);
      return undefined;
    }
  }
}
