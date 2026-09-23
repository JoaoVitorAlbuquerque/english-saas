import { UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

/** Id do usuário autenticado, colocado no request pelo guard de auth. */
export const ActiveUserId = createParamDecorator<undefined>(
  (_data, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{ userId?: string }>();

    if (!request.userId) {
      throw new UnauthorizedException();
    }

    return request.userId;
  },
);
