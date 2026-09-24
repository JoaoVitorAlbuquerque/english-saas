import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Correlaciona request, log e resposta de erro.
 *
 * O `requestId` vem do pino-http (header `x-request-id` do cliente ou um uuid
 * novo) e é devolvido no header da resposta, para o cliente conseguir citar
 * o id ao reportar um problema.
 *
 * O log de acesso em si fica com o pino-http; aqui só marcamos o que demora
 * mais que o orçamento de ~2s que o CLAUDE.md define para o request HTTP.
 */
const SLOW_REQUEST_MS = 2_000;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();

    const requestId = request.id ?? 'unknown';
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;

        if (durationMs > SLOW_REQUEST_MS) {
          this.logger.warn(
            {
              requestId,
              method: request.method,
              route: request.route?.path ?? request.url,
              durationMs,
            },
            'Request acima do orçamento de 2s — deveria estar numa fila?',
          );
        }
      }),
    );
  }
}
