import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import {
  SourceRateLimitedError,
  SourceUnavailableError,
} from '../generator.errors';
import {
  FAKE_WIKIPEDIA_PAGES,
  FAKE_WIKIPEDIA_SEARCH,
} from './wikipedia-fixtures';

export type WikipediaPage = {
  pageId: number;
  title: string;
  url: string;
  revisionId: string;
  /** Texto puro da página (`explaintext`). */
  extract: string;
  summary: string;
  isDisambiguation?: boolean;
};

/** Licença de todo texto da Wikipedia. Vai na atribuição do material. */
export const WIKIPEDIA_LICENSE = {
  name: 'CC BY-SA 4.0',
  url: 'https://creativecommons.org/licenses/by-sa/4.0/',
} as const;

/**
 * Acesso à Wikipedia em inglês. A classe abstrata é o token de injeção; o
 * `SOURCE_PROVIDER` escolhe a implementação (fake em teste).
 */
export abstract class WikipediaClient {
  /** Títulos de página para a busca, na ordem de relevância. */
  abstract search(query: string, limit: number): Promise<string[]>;
  /** A página pelo título, com texto, revisão e resumo. Nula se não existe. */
  abstract page(title: string): Promise<WikipediaPage | null>;
}

const MAXLAG_SECONDS = 5;

type SearchResponse = { query?: { search?: { title: string }[] } };
type PageResponse = {
  query?: {
    pages?: {
      pageid?: number;
      title: string;
      missing?: boolean;
      extract?: string;
      fullurl?: string;
      lastrevid?: number;
      pageprops?: { disambiguation?: string };
    }[];
  };
};
type SummaryResponse = { extract?: string };

/**
 * Cliente de verdade: API do MediaWiki (`action=query`) e a REST
 * (`page/summary`).
 *
 * Boa conduta com a Wikimedia: `User-Agent` identificado (env), `maxlag`
 * para ceder quando os servidores estão atrasados, 429 respeitado (o job
 * tenta de novo mais tarde) e uma requisição por vez neste processo. O
 * cache por título fica um nível acima, no `SourceService`.
 */
@Injectable()
export class HttpWikipediaClient extends WikipediaClient {
  private readonly logger = new Logger(HttpWikipediaClient.name);
  /** Fila de uma requisição por vez — a Wikimedia pede para não paralelizar. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly env: EnvService) {
    super();
  }

  async search(query: string, limit: number): Promise<string[]> {
    const data = await this.api<SearchResponse>({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(limit),
      srnamespace: '0',
    });

    return (data.query?.search ?? []).map((result) => result.title);
  }

  async page(title: string): Promise<WikipediaPage | null> {
    const data = await this.api<PageResponse>({
      action: 'query',
      prop: 'extracts|info|pageprops',
      titles: title,
      explaintext: '1',
      exsectionformat: 'plain',
      inprop: 'url',
      ppprop: 'disambiguation',
      redirects: '1',
    });

    const page = data.query?.pages?.[0];

    if (
      page === undefined ||
      page.missing === true ||
      page.pageid === undefined ||
      page.lastrevid === undefined
    ) {
      return null;
    }

    const summary = await this.summary(page.title);

    return {
      pageId: page.pageid,
      title: page.title,
      url:
        page.fullurl ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      revisionId: String(page.lastrevid),
      extract: page.extract ?? '',
      summary: summary ?? '',
      isDisambiguation: page.pageprops?.disambiguation !== undefined,
    };
  }

  private async summary(title: string): Promise<string | null> {
    const base = this.env.get('WIKIPEDIA_REST_URL');
    const path = `/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;

    try {
      const data = await this.get<SummaryResponse>(`${base}${path}`);
      return data.extract ?? null;
    } catch (error) {
      // O resumo é enfeite: sem ele, o material sai do mesmo jeito.
      if (error instanceof SourceRateLimitedError) throw error;
      return null;
    }
  }

  private async api<T>(params: Record<string, string>): Promise<T> {
    const search = new URLSearchParams({
      ...params,
      format: 'json',
      formatversion: '2',
      maxlag: String(MAXLAG_SECONDS),
      origin: '*',
    });

    return this.get<T>(
      `${this.env.get('WIKIPEDIA_API_URL')}?${search.toString()}`,
    );
  }

  private async get<T>(url: string): Promise<T> {
    const run = async (): Promise<T> => {
      let response: Response;

      try {
        response = await fetch(url, {
          headers: {
            'user-agent': this.env.get('WIKIPEDIA_USER_AGENT'),
            'api-user-agent': this.env.get('WIKIPEDIA_USER_AGENT'),
            accept: 'application/json',
          },
          signal: AbortSignal.timeout(this.env.get('CONTENT_FETCH_TIMEOUT_MS')),
        });
      } catch (error) {
        this.logger.warn({ err: error }, 'Wikipedia inacessível');
        throw new SourceUnavailableError('network');
      }

      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new SourceRateLimitedError(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
        );
      }

      if (!response.ok) {
        throw new SourceUnavailableError(`http_${String(response.status)}`);
      }

      const body = (await response.json()) as T & {
        error?: { code?: string };
      };

      // `maxlag` estourado vem como 200 com erro no corpo.
      if (body.error?.code === 'maxlag') {
        throw new SourceRateLimitedError(MAXLAG_SECONDS);
      }

      return body;
    };

    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }
}

/** Wikipedia de mentira, a partir de `wikipedia-fixtures.ts`. */
@Injectable()
export class FakeWikipediaClient extends WikipediaClient {
  /** Quantas páginas foram pedidas — o e2e prova o cache por título. */
  pageCalls = 0;

  async search(query: string, limit: number): Promise<string[]> {
    const words = query.toLowerCase().split(/\W+/);
    const titles = Object.entries(FAKE_WIKIPEDIA_SEARCH)
      .filter(([keyword]) => words.includes(keyword))
      .flatMap(([, found]) => found);
    const exact = FAKE_WIKIPEDIA_PAGES.filter(
      (page) => page.title.toLowerCase() === query.toLowerCase(),
    ).map((page) => page.title);

    return Promise.resolve([...new Set([...exact, ...titles])].slice(0, limit));
  }

  async page(title: string): Promise<WikipediaPage | null> {
    this.pageCalls += 1;
    return Promise.resolve(
      FAKE_WIKIPEDIA_PAGES.find(
        (page) => page.title.toLowerCase() === title.toLowerCase(),
      ) ?? null,
    );
  }
}
