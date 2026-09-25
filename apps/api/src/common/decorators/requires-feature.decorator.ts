import { SetMetadata } from '@nestjs/common';

import type { GuardableFeature } from 'src/modules/billing/domain/entitlements';

export const REQUIRES_FEATURE_KEY = 'REQUIRES_FEATURE';

/**
 * Exige que o plano do aluno ofereça a feature. Vale com
 * `@UseGuards(RequiresFeatureGuard)` do billing — não é guard global.
 *
 * Só confere o plano, não o saldo: quem gasta crédito reserva com o
 * `AiCreditService`. `LESSON_ACCESS` fica de fora (depende da unidade).
 */
export const RequiresFeature = (feature: GuardableFeature) =>
  SetMetadata(REQUIRES_FEATURE_KEY, feature);
