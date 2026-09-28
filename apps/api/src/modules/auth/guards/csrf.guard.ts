import { timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { CsrfTokenMismatchError } from '../auth.errors';
import { CSRF_HEADER, readCsrfCookieValues } from '../auth.cookies';

/**
 * Double-submit cookie.
 *
 * O refresh token vive num cookie httpOnly, então o browser o manda sozinho —
 * e é isso que abre espaço para CSRF. Junto dele emitimos um `csrf_token`
 * **legível** por JavaScript; o front copia esse valor para o header
 * `x-csrf-token`. Um site de terceiros consegue disparar a requisição com o
 * cookie, mas não consegue ler o valor para montar o header.
 *
 * Pode chegar mais de um `csrf_token` (o legado de `Path=/auth` junto do
 * atual): basta o header bater com um deles — todos são legíveis só pelo
 * nosso front.
 *
 * Use nas rotas que dependem do cookie: `/auth/refresh` e `/auth/logout`.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const cookieValues = readCsrfCookieValues(request.headers.cookie);
    const headerValue = request.headers[CSRF_HEADER];

    if (typeof headerValue !== 'string' || headerValue.length === 0) {
      throw new CsrfTokenMismatchError();
    }

    const headerBuffer = Buffer.from(headerValue);
    const matches = cookieValues.some((value) => {
      const cookieBuffer = Buffer.from(value);

      return (
        cookieBuffer.length === headerBuffer.length &&
        timingSafeEqual(cookieBuffer, headerBuffer)
      );
    });

    if (!matches) {
      throw new CsrfTokenMismatchError();
    }

    return true;
  }
}
