import { Injectable } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { classifyUrl } from '../domain/ingest';
import {
  ContentTooShortError,
  InvalidContentUrlError,
  TranscriptRequiredError,
} from '../generator.errors';
import { ArticleFetcher } from './article-fetcher';

/** O que o aluno mandou: texto, link, ou os dois (link como referência). */
export type IngestInput = { text: string | null; url: string | null };

export type LoadedContent = {
  text: string;
  title: string | null;
  /** Link que o aluno mandou, guardado só como referência. */
  referenceUrl: string | null;
  origin: 'PASTED_TEXT' | 'ARTICLE' | 'SOCIAL_TRANSCRIPT';
};

/**
 * De onde vem o texto de um material do aluno. Cada adaptador diz se trata
 * a entrada e como carregar o texto dela.
 *
 * Próximo adaptador previsto, fora do MVP: **áudio enviado pelo próprio
 * aluno** (arquivo dele, não baixado de plataforma nenhuma) transcrito pelo
 * `SpeechToText` do tutor (12) — entra aqui como mais uma implementação.
 */
export interface IngestSource {
  readonly origin: LoadedContent['origin'];
  canHandle(input: IngestInput): boolean;
  load(input: IngestInput): Promise<LoadedContent>;
}

/** Menos que isto não rende material (e costuma ser engano). */
export const MIN_INGEST_CHARS = 200;

/**
 * Link de rede social (YouTube, Instagram, Facebook, TikTok) com a
 * transcrição colada. **Nunca baixa a mídia**: o link fica como referência
 * e o texto é o que o aluno colou.
 */
export class SocialTranscriptSource implements IngestSource {
  readonly origin = 'SOCIAL_TRANSCRIPT' as const;

  canHandle(input: IngestInput): boolean {
    return (
      input.url !== null &&
      input.text !== null &&
      classifyUrl(input.url).kind === 'SOCIAL'
    );
  }

  async load(input: IngestInput): Promise<LoadedContent> {
    return Promise.resolve({
      text: input.text ?? '',
      title: null,
      referenceUrl: input.url,
      origin: this.origin,
    });
  }
}

/** Texto colado (reportagem, letra de música, qualquer texto). */
export class PastedTextSource implements IngestSource {
  readonly origin = 'PASTED_TEXT' as const;

  canHandle(input: IngestInput): boolean {
    return input.text !== null;
  }

  async load(input: IngestInput): Promise<LoadedContent> {
    return Promise.resolve({
      text: input.text ?? '',
      title: null,
      referenceUrl: input.url,
      origin: this.origin,
    });
  }
}

/** URL de artigo, buscada no servidor (no job, nunca no request). */
export class ArticleUrlSource implements IngestSource {
  readonly origin = 'ARTICLE' as const;

  constructor(private readonly fetcher: ArticleFetcher) {}

  canHandle(input: IngestInput): boolean {
    return (
      input.text === null &&
      input.url !== null &&
      classifyUrl(input.url).kind === 'ARTICLE'
    );
  }

  async load(input: IngestInput): Promise<LoadedContent> {
    const url = classifyUrl(input.url ?? '');

    if (url.kind !== 'ARTICLE') {
      throw new InvalidContentUrlError('not_article');
    }

    const article = await this.fetcher.fetch(url.url);

    return {
      text: article.text,
      title: article.title,
      referenceUrl: article.finalUrl,
      origin: this.origin,
    };
  }
}

/**
 * Escolhe o adaptador. A validação do que dá para aceitar roda duas vezes:
 * no request (`assertAcceptable`, para responder 422 na hora, sem cobrar) e
 * no job (`load`).
 */
@Injectable()
export class IngestSources {
  private readonly sources: IngestSource[];

  constructor(
    fetcher: ArticleFetcher,
    private readonly env: EnvService,
  ) {
    this.sources = [
      new SocialTranscriptSource(),
      new PastedTextSource(),
      new ArticleUrlSource(fetcher),
    ];
  }

  /** O pedido é aceitável? Lança o erro que o aluno precisa ver. */
  assertAcceptable(input: IngestInput): void {
    if (input.url !== null) {
      const url = classifyUrl(input.url);

      if (url.kind === 'INVALID') {
        throw new InvalidContentUrlError(url.reason);
      }

      if (url.kind === 'SOCIAL' && input.text === null) {
        throw new TranscriptRequiredError(url.platform);
      }
    }

    if (input.text !== null && input.text.trim().length < MIN_INGEST_CHARS) {
      throw new ContentTooShortError();
    }
  }

  async load(input: IngestInput): Promise<LoadedContent> {
    this.assertAcceptable(input);
    const source = this.sources.find((candidate) => candidate.canHandle(input));

    if (source === undefined) {
      throw new InvalidContentUrlError('no_source');
    }

    const loaded = await source.load(input);
    const text = loaded.text.trim().slice(0, this.env.get('CONTENT_MAX_CHARS'));

    if (text.length < MIN_INGEST_CHARS) {
      throw new ContentTooShortError();
    }

    return { ...loaded, text };
  }
}
