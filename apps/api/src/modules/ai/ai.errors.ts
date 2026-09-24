import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/**
 * A IA respondeu, mas a resposta não bate com o schema nem depois do reparo.
 * Nunca salvamos nem usamos JSON de IA que não passou no zod.
 */
export class AiValidationError extends AppException {
  /** `source`: o promptId quando há um, senão o nome da feature. */
  constructor(
    readonly source: string,
    details?: unknown,
  ) {
    super(
      'AI_VALIDATION_FAILED',
      'A IA não conseguiu gerar um resultado no formato esperado. Tente de novo em instantes.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
    this.name = 'AiValidationError';
  }
}

/** O provedor falhou (rede, 5xx, timeout, cota) depois dos retries. */
export class AiProviderError extends AppException {
  constructor(
    readonly reason: string,
    details?: unknown,
  ) {
    super(
      'AI_PROVIDER_UNAVAILABLE',
      'Nosso serviço de IA está indisponível agora. Tente de novo em instantes.',
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
    this.name = 'AiProviderError';
  }
}

/** O conteúdo enviado passou do teto de caracteres da feature. */
export class AiInputTooLargeError extends AppException {
  constructor(limit: number, length: number) {
    super(
      'AI_INPUT_TOO_LARGE',
      `O conteúdo enviado é muito grande (${String(length)} caracteres). O limite é ${String(limit)}.`,
      HttpStatus.PAYLOAD_TOO_LARGE,
      { limit, length },
    );
    this.name = 'AiInputTooLargeError';
  }
}
