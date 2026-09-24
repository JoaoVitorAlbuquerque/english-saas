import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { API_ERROR_CODES, type ApiError } from '@english-saas/shared';
import type { Request } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { AppException } from '../errors/app.exception';

type HttpExceptionBody = {
  code?: string;
  message?: string | string[];
  details?: unknown;
};

type Described = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
};

/**
 * Filtro global: toda resposta de erro sai como
 * `{ error: { code, message, details? } }`.
 *
 * Detalhe interno de erro 500 nunca vaza para o cliente — vai só para o log,
 * junto do `requestId`, que também volta no header `x-request-id`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string }>();
    const response = ctx.getResponse<{
      setHeader?: (k: string, v: string) => void;
    }>();

    const { statusCode, code, message, details } = this.describe(exception);
    const requestId = request?.id ?? 'unknown';

    if (typeof response?.setHeader === 'function') {
      response.setHeader('x-request-id', requestId);
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({ err: exception, requestId }, 'Erro não tratado');
    }

    const body: ApiError = {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    };

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }

  private describe(exception: unknown): Described {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    // Body, query ou param que não bateu com o DTO zod. O nestjs-zod guarda
    // as issues dentro da exceção, não no corpo da resposta HTTP.
    if (exception instanceof ZodValidationException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Os dados enviados não estão no formato esperado.',
        details: this.zodIssues(exception.getZodError()),
      };
    }

    // Saída de IA ou payload interno que não bateu com o schema.
    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Os dados enviados não estão no formato esperado.',
        details: exception.issues,
      };
    }

    if (exception instanceof HttpException) {
      return this.describeHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
    };
  }

  private describeHttpException(exception: HttpException): Described {
    const response = exception.getResponse();
    const parsed: HttpExceptionBody =
      typeof response === 'string' ? { message: response } : response;

    const status = exception.getStatus();
    const message = Array.isArray(parsed.message)
      ? parsed.message.join('; ')
      : (parsed.message ?? exception.message);

    return {
      statusCode: status,
      code: parsed.code ?? this.codeFromStatus(status),
      message: this.friendlyMessage(status, message),
      details: parsed.details,
    };
  }

  /**
   * Mensagem padrão do Nest é em inglês. Para os status que o aluno pode ver,
   * trocamos por pt-BR; o resto passa como veio (normalmente já é nosso).
   */
  private friendlyMessage(status: number, fallback: string): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'Você precisa entrar na sua conta para continuar.';
      case HttpStatus.FORBIDDEN:
        return 'Você não tem acesso a este conteúdo.';
      case HttpStatus.NOT_FOUND:
        return 'Não encontramos o que você procura.';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Você fez muitas requisições seguidas. Espere um pouco e tente de novo.';
      default:
        return fallback;
    }
  }

  /** `getZodError()` devolve `unknown`; só publicamos se for mesmo um ZodError. */
  private zodIssues(error: unknown): unknown {
    return error instanceof ZodError ? error.issues : undefined;
  }

  private codeFromStatus(status: number): string {
    const name: unknown = HttpStatus[status as HttpStatus];
    return typeof name === 'string' ? name : `HTTP_${String(status)}`;
  }
}
