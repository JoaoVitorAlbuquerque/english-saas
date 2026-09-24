import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from 'src/common/decorators/is-public.decorator';

import type { JwtPayload } from '../services/auth.service';

/** O que o guard pendura no request para os decorators lerem. */
export type RequestUser = {
  id: string;
  email: string;
  role: JwtPayload['role'];
};

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}

/**
 * Guard global de autenticação.
 *
 * Toda rota exige um access token válido, a não ser que esteja marcada com
 * `@IsPublic()`. O access token vive só na memória do front e viaja no
 * header `Authorization: Bearer` — nunca em cookie.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (token === undefined) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    return scheme === 'Bearer' ? token : undefined;
  }
}
