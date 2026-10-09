import {
  PLAN_LIMITS,
  type PlanView,
  type UpdatePlan,
} from '@english-saas/api-client';

import { centsToInput, parseBrlToCents } from './money';

/**
 * Uma linha da tabela de planos em edição. Tudo em texto, como o campo: o
 * preço é em reais e vira centavos só na hora de mandar.
 */
export type PlanDraft = { price: string; credits: string; active: boolean };

export type PlanFieldError =
  'PRICE_INVALID' | 'PRICE_TOO_BIG' | 'CREDITS_INVALID' | 'CREDITS_TOO_BIG';

export type PlanFormResult = {
  /** Só o que mudou; `null` quando não mudou nada ou há erro. */
  patch: UpdatePlan | null;
  errors: { price?: PlanFieldError; credits?: PlanFieldError };
};

export function draftOf(plan: PlanView): PlanDraft {
  return {
    price: centsToInput(plan.priceCents),
    credits: String(plan.monthlyAiCredits),
    active: plan.active,
  };
}

/** O FREE não tem período nem preço: só a cota de créditos. */
export function hasPrice(plan: PlanView): boolean {
  return plan.tier !== 'FREE';
}

export function planPatch(plan: PlanView, draft: PlanDraft): PlanFormResult {
  const errors: PlanFormResult['errors'] = {};
  const patch: UpdatePlan = {};

  if (hasPrice(plan)) {
    const cents = parseBrlToCents(draft.price);

    if (cents === null) {
      errors.price = 'PRICE_INVALID';
    } else if (cents > PLAN_LIMITS.priceCentsMax) {
      errors.price = 'PRICE_TOO_BIG';
    } else if (cents !== plan.priceCents) {
      patch.priceCents = cents;
    }
  }

  const credits = draft.credits.trim();

  if (!/^\d+$/.test(credits)) {
    errors.credits = 'CREDITS_INVALID';
  } else if (Number(credits) > PLAN_LIMITS.monthlyAiCreditsMax) {
    errors.credits = 'CREDITS_TOO_BIG';
  } else if (Number(credits) !== plan.monthlyAiCredits) {
    patch.monthlyAiCredits = Number(credits);
  }

  if (draft.active !== plan.active) {
    patch.active = draft.active;
  }

  const hasErrors = Object.keys(errors).length > 0;

  return {
    patch: hasErrors || Object.keys(patch).length === 0 ? null : patch,
    errors,
  };
}
