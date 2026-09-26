import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { SourceProvider, type SourceDocument } from '@prisma/client';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';

import { SourceNotFoundError } from '../generator.errors';
import {
  WIKIPEDIA_LICENSE,
  WikipediaClient,
  type WikipediaPage,
} from './wikipedia-client';

/** Resultados de busca que valem olhar antes de desistir. */
const SEARCH_LIMIT = 5;
/** Página menor que isto não dá um texto com fatos suficientes. */
export const MIN_SOURCE_CHARS = 1_500;
const SEARCH_CACHE_SECONDS = 24 * 60 * 60;
const PAGE_CACHE_SECONDS = 6 * 60 * 60;

/**
 * Acha a fonte de um tema na Wikipedia em inglês e guarda a revisão usada.
 *
 * Duas camadas de cache: no Redis, a busca e a página por título (a mesma
 * pergunta de dois alunos não vira duas idas à Wikipedia); no banco, o
 * `SourceDocument` por revisão, que é o que o material cita na atribuição.
 */
@Injectable()
export class SourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly env: EnvService,
    private readonly wikipedia: WikipediaClient,
  ) {}

  async find(query: string): Promise<SourceDocument> {
    const titles = await this.search(query);

    for (const title of titles) {
      const page = await this.page(title);

      if (
        page === null ||
        page.isDisambiguation === true ||
        page.extract.length < MIN_SOURCE_CHARS
      ) {
        continue;
      }

      return this.save(page);
    }

    throw new SourceNotFoundError();
  }

  async findById(id: string): Promise<SourceDocument> {
    return this.prisma.sourceDocument.findUniqueOrThrow({ where: { id } });
  }

  private async search(query: string): Promise<string[]> {
    const key = `generator:wiki:search:v1:${hash(query.trim().toLowerCase())}`;
    const cached = await this.redis.client.get(key);

    if (cached !== null) {
      return JSON.parse(cached) as string[];
    }

    const titles = await this.wikipedia.search(query, SEARCH_LIMIT);
    await this.redis.client.set(
      key,
      JSON.stringify(titles),
      'EX',
      SEARCH_CACHE_SECONDS,
    );
    return titles;
  }

  private async page(title: string): Promise<WikipediaPage | null> {
    const key = `generator:wiki:page:v1:${hash(title.trim().toLowerCase())}`;
    const cached = await this.redis.client.get(key);

    if (cached !== null) {
      return JSON.parse(cached) as WikipediaPage | null;
    }

    const page = await this.wikipedia.page(title);
    const stored =
      page === null
        ? null
        : {
            ...page,
            extract: page.extract.slice(0, this.env.get('CONTENT_MAX_CHARS')),
          };

    await this.redis.client.set(
      key,
      JSON.stringify(stored),
      'EX',
      PAGE_CACHE_SECONDS,
    );
    return stored;
  }

  private async save(page: WikipediaPage): Promise<SourceDocument> {
    const where = {
      provider_pageId_revisionId: {
        provider: SourceProvider.WIKIPEDIA,
        pageId: page.pageId,
        revisionId: BigInt(page.revisionId),
      },
    };

    // Dois alunos com a mesma página ao mesmo tempo: o upsert resolve.
    return this.prisma.sourceDocument.upsert({
      where,
      update: {},
      create: {
        provider: SourceProvider.WIKIPEDIA,
        pageId: page.pageId,
        title: page.title,
        url: page.url,
        revisionId: BigInt(page.revisionId),
        license: WIKIPEDIA_LICENSE.name,
        licenseUrl: WIKIPEDIA_LICENSE.url,
        extract: page.extract,
        summary: page.summary,
      },
    });
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
