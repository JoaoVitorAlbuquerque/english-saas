import { timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { CsrfTokenMismatchError } from '../auth.errors';
import { CSRF_COOKIE, CSRF_HEADER } from '../auth.cookies';

/**
 * Double-submit cookie.
 *
 * O refresh token vive num cookie httpOnly, então o browser o manda sozinho —
 * e é isso que abre espaço para CSRF. Junto dele emitimos um `csrf_token`
 * **legível** por JavaScript; o front copia esse valor para o header
 * `x-csrf-token`. Um site de terceiros consegue disparar a requisição com o
 * cookie, mas não consegue ler o valor para montar o header.
 *
 * Use nas rotas que dependem do cookie: `/auth/refresh` e `/auth/logout`.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const cookieValue = (
      request.cookies as Record<string, string> | undefined
    )?.[CSRF_COOKIE];
    const headerValue = request.headers[CSRF_HEADER];

    if (
      typeof cookieValue !== 'string' ||
      typeof headerValue !== 'string' ||
      cookieValue.length === 0
    ) {
      throw new CsrfTokenMismatchError();
    }

    const cookieBuffer = Buffer.from(cookieValue);
    const headerBuffer = Buffer.from(headerValue);

    if (
      cookieBuffer.length !== headerBuffer.length ||
      !timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      throw new CsrfTokenMismatchError();
    }

    return true;
  }
}
