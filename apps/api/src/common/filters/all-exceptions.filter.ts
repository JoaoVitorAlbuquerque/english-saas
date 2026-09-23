import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ApiError } from '@english-saas/shared';
import type { Request } from 'express';
import { ZodError } from 'zod';

import { AppException } from '../errors/app.exception';

type HttpExceptionBody = {
  code?: string;
  message?: string | string[];
  details?: unknown;
};

/**
 * Filtro global: toda resposta de erro da API sai no formato `ApiError`.
 * Detalhe interno de erro 500 nunca vaza para o cliente — vai só para o log.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string }>();

    const { statusCode, code, message, details } = this.describe(exception);

    const body: ApiError = {
      statusCode,
      code,
      message,
      details,
      requestId: request?.id ?? 'unknown',
      path: httpAdapter.getRequestUrl(request) ?? '',
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, requestId: body.requestId },
        'Erro não tratado',
      );
    }

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }

  private describe(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    // Saída de IA ou payload interno que não bateu com o schema.
    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'VALIDATION_FAILED',
        message: 'Os dados enviados não estão no formato esperado.',
        details: exception.issues,
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const parsed: HttpExceptionBody =
        typeof response === 'string' ? { message: response } : response;

      const message = Array.isArray(parsed.message)
        ? parsed.message.join('; ')
        : (parsed.message ?? exception.message);

      return {
        statusCode: exception.getStatus(),
        code: parsed.code ?? this.codeFromStatus(exception.getStatus()),
        message,
        details: parsed.details,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
    };
  }

  private codeFromStatus(status: number): string {
    const name: unknown = HttpStatus[status as HttpStatus];
    return typeof name === 'string' ? name : `HTTP_${String(status)}`;
  }
}
