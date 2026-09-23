import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Erro de aplicação com código estável.
 *
 * - `code`: em inglês, SCREAMING_SNAKE_CASE. O cliente decide com base nele.
 * - `message`: em pt-BR, pronto para exibir ao aluno.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export class NotFoundError extends AppException {
  constructor(
    message = 'Não encontramos o que você procura.',
    details?: unknown,
  ) {
    super('NOT_FOUND', message, HttpStatus.NOT_FOUND, details);
  }
}

export class ForbiddenError extends AppException {
  constructor(
    message = 'Você não tem acesso a este conteúdo.',
    details?: unknown,
  ) {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN, details);
  }
}

export class ConflictError extends AppException {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}
