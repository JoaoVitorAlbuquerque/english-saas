import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros do generator. `code` em inglês, `message` em pt-BR. */

/**
 * Erro que não melhora tentando de novo (fonte inexistente, texto que não é
 * inglês, robots.txt proibindo). O job desiste na hora, com estorno, em vez
 * de gastar outra tentativa — e outra chamada de IA.
 */
export class FinalGenerationError extends AppException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class SourceNotFoundError extends FinalGenerationError {
  constructor() {
    super(
      'SOURCE_NOT_FOUND',
      'Não achamos uma fonte confiável sobre esse assunto. Tenta outro tema.',
    );
  }
}

export class ContentNotEnglishError extends FinalGenerationError {
  constructor() {
    super(
      'CONTENT_NOT_ENGLISH',
      'Esse texto não parece estar em inglês. Manda um conteúdo em inglês que a gente monta o material.',
    );
  }
}

export class ContentTooShortError extends FinalGenerationError {
  constructor() {
    super(
      'CONTENT_TOO_SHORT',
      'Esse texto é curto demais para virar material. Manda um trecho maior.',
    );
  }
}

export class ArticleUnavailableError extends FinalGenerationError {
  constructor(reason: string) {
    super(
      'ARTICLE_UNAVAILABLE',
      'Não conseguimos ler essa página. Copia o texto e cola aqui que funciona.',
      { reason },
    );
  }
}

export class LevelOutOfRangeError extends FinalGenerationError {
  constructor(details: unknown) {
    super(
      'LEVEL_OUT_OF_RANGE',
      'Não conseguimos deixar o texto no seu nível desta vez.',
      details,
    );
  }
}

export class NotEnoughExercisesError extends AppException {
  constructor(issues: string[]) {
    super(
      'NOT_ENOUGH_EXERCISES',
      'Não conseguimos montar exercícios bons para esse texto.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { issues },
    );
  }
}

/** Temporário: a Wikipedia pediu para esperar. O retry do job resolve. */
export class SourceRateLimitedError extends AppException {
  constructor(retryAfterSeconds: number | null) {
    super(
      'SOURCE_RATE_LIMITED',
      'A fonte está ocupada. Tentamos de novo em instantes.',
      HttpStatus.SERVICE_UNAVAILABLE,
      { retryAfterSeconds },
    );
  }
}

export class SourceUnavailableError extends AppException {
  constructor(reason: string) {
    super(
      'SOURCE_UNAVAILABLE',
      'Não conseguimos falar com a fonte agora.',
      HttpStatus.BAD_GATEWAY,
      { reason },
    );
  }
}

export class TranscriptRequiredError extends AppException {
  constructor(platform: string) {
    super(
      'TRANSCRIPT_REQUIRED',
      'Não baixamos vídeo nem post de rede social. Cola aqui a legenda ou a transcrição junto com o link que a gente monta o material.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { platform },
    );
  }
}

export class InvalidContentUrlError extends AppException {
  constructor(reason: string) {
    super(
      'INVALID_CONTENT_URL',
      'Esse link não dá para usar. Confere o endereço ou cola o texto direto.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { reason },
    );
  }
}

export class SuggestionNotFoundError extends AppException {
  constructor() {
    super(
      'SUGGESTION_NOT_FOUND',
      'Essa sugestão não existe mais. Pede novas sugestões e escolhe de novo.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class SuggestionsPendingError extends AppException {
  constructor() {
    super(
      'SUGGESTIONS_PENDING',
      'As sugestões ainda estão sendo preparadas. Espera um pouquinho.',
      HttpStatus.CONFLICT,
    );
  }
}
