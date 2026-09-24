import { UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Id do usuário autenticado, colocado no request pelo `JwtAuthGuard`. */
export const ActiveUserId = createParamDecorator<undefined>(
  (_data, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.user === undefined) {
      throw new UnauthorizedException();
    }

    return request.user.id;
  },
);

/** Usuário autenticado inteiro: id, e-mail e papel. */
export const ActiveUser = createParamDecorator<undefined>(
  (_data, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.user === undefined) {
      throw new UnauthorizedException();
    }

    return request.user;
  },
);
