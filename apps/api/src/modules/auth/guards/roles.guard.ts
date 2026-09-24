import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@english-saas/shared';
import type { Request } from 'express';

import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { ForbiddenError } from 'src/common/errors/app.exception';

/**
 * Restringe a rota aos papéis do `@Roles`.
 *
 * Roda depois do `JwtAuthGuard`, então `request.user` já está preenchido —
 * a ordem em `providers` do AppModule é o que garante isso.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const role = request.user?.role;

    if (role === undefined || !required.includes(role)) {
      throw new ForbiddenError(
        'Esta área é restrita. Sua conta não tem acesso a ela.',
      );
    }

    return true;
  }
}
