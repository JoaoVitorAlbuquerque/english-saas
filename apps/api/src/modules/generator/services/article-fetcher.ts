import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';

import { Injectable, Logger } from '@nestjs/common';
import robotsParser from 'robots-parser';

import { EnvService } from 'src/common/config/env.service';
import { RedisService } from 'src/infra/redis/redis.service';

import { classifyUrl, isPrivateAddress } from '../domain/ingest';
import { ArticleUnavailableError } from '../generator.errors';
import { extractArticle } from './article-extract';

export type FetchedArticle = {
  title: string | null;
  text: string;
  finalUrl: string;
};

/**
 * Lê o texto de uma reportagem a partir da URL. A classe abstrata é o token
 * de injeção; `ARTICLE_FETCH_PROVIDER` escolhe (fake em teste).
 */
export abstract class ArticleFetcher {
  abstract fetch(url: URL): Promise<FetchedArticle>;
}

const MAX_REDIRECTS = 3;
const ROBOTS_CACHE_SECONDS = 60 * 60;
const ROBOTS_MAX_BYTES = 500_000;

type Resolver = (hostname: string) => Promise<LookupAddress[]>;

const systemResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });

/**
 * Resolve o host e recusa se **qualquer** endereço for interno. É a trava
 * contra SSRF: sem ela, um link para `http://169.254.169.254/` (metadata da
 * nuvem) ou para a rede interna seria buscado pelo nosso servidor.
 */
export async function resolvePublicAddresses(
  hostname: string,
  resolve: Resolver = systemResolver,
): Promise<LookupAddress[]> {
  const addresses = await resolve(hostname);

  if (addresses.length === 0) {
    throw new ArticleUnavailableError('dns_empty');
  }

  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new ArticleUnavailableError('private_address');
  }

  return addresses;
}

/**
 * `lookup` para o `http.request`: o socket só conecta num endereço que
 * passou pela checagem. Resolver aqui (e não antes) fecha a porta do DNS
 * rebinding — não existe uma segunda resolução entre checar e conectar.
 */
function guardedLookup(resolve: Resolver): LookupFunction {
  return (hostname, options, callback) => {
    resolvePublicAddresses(hostname, resolve)
      .then((addresses) => {
        const family = typeof options === 'object' ? options.family : undefined;
        const usable =
          family === 4 || family === 6
            ? addresses.filter((entry) => entry.family === family)
            : addresses;
        const first = usable[0] ?? addresses[0];

        if (first === undefined) {
          callback(new Error('no address'), '', 4);
          return;
        }

        if (typeof options === 'object' && options.all === true) {
          (callback as unknown as (e: null, a: LookupAddress[]) => void)(
            null,
            usable,
          );
          return;
        }

        callback(null, first.address, first.family);
      })
      .catch((error: unknown) => {
        callback(error as NodeJS.ErrnoException, '', 4);
      });
  };
}

type RawResponse = {
  status: number;
  headers: IncomingMessage['headers'];
  body: Buffer;
};

/**
 * Busca de verdade, com o cuidado de quem busca a pedido de terceiros:
 *
 * - só http/https, portas padrão, sem IP interno (checado a cada conexão);
 * - redirecionamento manual, no máximo 3, cada destino revalidado;
 * - `robots.txt` respeitado para o nosso User-Agent (cache de 1h por host);
 * - só `text/html`, lido até `ARTICLE_MAX_BYTES` e cortado ali;
 * - texto extraído com Readability (o miolo da página, sem menu e
 *   rodapé) e cortado em `CONTENT_MAX_CHARS`.
 */
@Injectable()
export class HttpArticleFetcher extends ArticleFetcher {
  private readonly logger = new Logger(HttpArticleFetcher.name);

  constructor(
    private readonly env: EnvService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async fetch(url: URL): Promise<FetchedArticle> {
    let current = url;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await this.assertRobotsAllow(current);
      const response = await this.request(current, this.maxBytes());

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;

        if (location === undefined) {
          throw new ArticleUnavailableError('redirect_without_location');
        }

        const next = classifyUrl(new URL(location, current).toString());

        if (next.kind !== 'ARTICLE') {
          throw new ArticleUnavailableError('redirect_not_allowed');
        }

        current = next.url;
        continue;
      }

      if (response.status !== 200) {
        throw new ArticleUnavailableError(`http_${String(response.status)}`);
      }

      const type = String(response.headers['content-type'] ?? '');

      if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
        throw new ArticleUnavailableError('not_html');
      }

      return this.extract(response.body.toString('utf8'), current);
    }

    throw new ArticleUnavailableError('too_many_redirects');
  }

  private async extract(html: string, url: URL): Promise<FetchedArticle> {
    const article = await extractArticle(html, url.toString());

    const text = article.text
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim()
      .slice(0, this.env.get('CONTENT_MAX_CHARS'));

    if (text.length === 0) {
      throw new ArticleUnavailableError('no_article_text');
    }

    return { title: article.title, text, finalUrl: url.toString() };
  }

  private async assertRobotsAllow(url: URL): Promise<void> {
    const robotsUrl = new URL('/robots.txt', url.origin).toString();
    const key = `generator:robots:v1:${url.origin}`;
    let body = await this.redis.client.get(key);

    if (body === null) {
      try {
        const response = await this.request(
          new URL(robotsUrl),
          ROBOTS_MAX_BYTES,
        );
        // Sem robots.txt (4xx) = tudo liberado; erro do servidor = na dúvida, não.
        body =
          response.status === 200
            ? response.body.toString('utf8')
            : response.status >= 400 && response.status < 500
              ? ''
              : 'User-agent: *\nDisallow: /';
      } catch (error) {
        if (error instanceof ArticleUnavailableError) throw error;
        body = 'User-agent: *\nDisallow: /';
      }

      await this.redis.client.set(key, body, 'EX', ROBOTS_CACHE_SECONDS);
    }

    const robots = robotsParser(robotsUrl, body);

    if (robots.isAllowed(url.toString(), this.userAgent()) === false) {
      throw new ArticleUnavailableError('robots_disallow');
    }
  }

  private request(url: URL, maxBytes: number): Promise<RawResponse> {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const req = send(
        url,
        {
          method: 'GET',
          headers: {
            'user-agent': this.userAgent(),
            accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          },
          lookup: guardedLookup(systemResolver),
          timeout: this.env.get('CONTENT_FETCH_TIMEOUT_MS'),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;

          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              // Página grande demais: fica com o começo, que é onde está o texto.
              chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
              res.destroy();
              resolve({
                status: res.statusCode ?? 0,
                headers: res.headers,
                body: Buffer.concat(chunks),
              });
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks),
            });
          });
          res.on('error', reject);
        },
      );

      req.on('timeout', () => {
        req.destroy(new ArticleUnavailableError('timeout'));
      });
      req.on('error', (error) => {
        this.logger.warn({ err: error, host: url.host }, 'Falha ao buscar URL');
        reject(
          error instanceof ArticleUnavailableError
            ? error
            : new ArticleUnavailableError('network'),
        );
      });
      req.end();
    });
  }

  private userAgent(): string {
    return this.env.get('WIKIPEDIA_USER_AGENT');
  }

  private maxBytes(): number {
    return this.env.get('ARTICLE_MAX_BYTES');
  }
}

/** Páginas de mentira para o e2e. URL fora da lista = página inacessível. */
export const FAKE_ARTICLES: Record<string, FetchedArticle> = {
  'https://news.example.com/whales': {
    title: 'Whales return to the bay',
    finalUrl: 'https://news.example.com/whales',
    text: [
      'Whales came back to the bay this winter.',
      'Fishermen saw a big group of whales near the beach in June.',
      'The whales stayed in the warm water for three weeks.',
      'Scientists counted more than forty animals.',
      'They think the clean water brought the whales back.',
      'The city closed part of the beach to protect them.',
      'Many families came to watch the whales from the hills.',
      'Local schools organized trips to see the animals.',
      'The whales left the bay at the end of July.',
      'Scientists hope they come back next year.',
    ].join(' '),
  },
};

@Injectable()
export class FakeArticleFetcher extends ArticleFetcher {
  async fetch(url: URL): Promise<FetchedArticle> {
    const article = FAKE_ARTICLES[url.toString()];

    if (article === undefined) {
      throw new ArticleUnavailableError('robots_disallow');
    }

    return Promise.resolve(article);
  }
}
