import { Injectable } from '@nestjs/common';

import {
  ALLOWED,
  planRequired,
  type AccessDecision,
  type AccessPolicy,
  type LessonAccessInput,
} from 'src/common/access/access-policy';

import { canAccessLesson, canUseFeature } from '../domain/entitlements';
import { EntitlementsService } from './entitlements.service';

/**
 * A política de acesso por plano que o curriculum (4) e o learning (6)
 * consultam pelo token `ACCESS_POLICY` — ligada no AppModule, sem que eles
 * importem o billing.
 *
 * FREE abre a primeira unidade de cada nível; BASE e PLUS, tudo. Apostila em
 * PDF é BASE para cima.
 */
@Injectable()
export class BillingAccessPolicy implements AccessPolicy {
  constructor(private readonly entitlements: EntitlementsService) {}

  async canAccessLesson(
    userId: string,
    input: LessonAccessInput,
  ): Promise<AccessDecision> {
    const { tier } = await this.entitlements.currentPlan(userId);

    return canAccessLesson(tier, { unitIndexInLevel: input.unitPosition })
      ? ALLOWED
      : planRequired('BASE');
  }

  async canDownloadWorkbook(userId: string): Promise<AccessDecision> {
    const { tier } = await this.entitlements.currentPlan(userId);

    return canUseFeature(tier, 'PDF_DOWNLOAD') ? ALLOWED : planRequired('BASE');
  }
}
