import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { REQUIRES_FEATURE_KEY } from 'src/common/decorators/requires-feature.decorator';

import { FeatureNotAvailableError } from '../billing.errors';
import { canUseFeature, type GuardableFeature } from '../domain/entitlements';
import { EntitlementsService } from '../services/entitlements.service';

/**
 * Recusa a rota se o plano do aluno não tem a feature do
 * `@RequiresFeature`. Roda depois do `JwtAuthGuard` global, então
 * `request.user` já está preenchido.
 */
@Injectable()
export class RequiresFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<
      GuardableFeature | undefined
    >(REQUIRES_FEATURE_KEY, [context.getHandler(), context.getClass()]);

    if (feature === undefined) {
      return true;
    }

    const userId = context.switchToHttp().getRequest<Request>().user?.id;

    if (userId === undefined) {
      throw new UnauthorizedException();
    }

    const { tier } = await this.entitlements.currentPlan(userId);

    if (!canUseFeature(tier, feature)) {
      throw new FeatureNotAvailableError(feature, tier);
    }

    return true;
  }
}
