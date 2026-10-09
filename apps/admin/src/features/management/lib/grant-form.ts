import { BONUS_LIMITS, type GrantBonus } from '@english-saas/api-client';

export type GrantDraft = { amount: string; reason: string };

export type GrantFieldError =
  | 'AMOUNT_INVALID'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'REASON_REQUIRED'
  | 'REASON_TOO_LONG';

export type GrantFormResult = {
  value: GrantBonus | null;
  errors: { amount?: GrantFieldError; reason?: GrantFieldError };
};

/** Os mesmos limites da API (`grantBonusSchema`, em `packages/shared`). */
export function validateGrant(draft: GrantDraft): GrantFormResult {
  const errors: GrantFormResult['errors'] = {};
  const amountText = draft.amount.trim();
  const reason = draft.reason.trim();

  if (!/^\d+$/.test(amountText)) {
    errors.amount = 'AMOUNT_INVALID';
  } else if (
    Number(amountText) < BONUS_LIMITS.amountMin ||
    Number(amountText) > BONUS_LIMITS.amountMax
  ) {
    errors.amount = 'AMOUNT_OUT_OF_RANGE';
  }

  if (reason === '') {
    errors.reason = 'REASON_REQUIRED';
  } else if (reason.length > BONUS_LIMITS.reasonMax) {
    errors.reason = 'REASON_TOO_LONG';
  }

  return Object.keys(errors).length > 0
    ? { value: null, errors }
    : { value: { amount: Number(amountText), reason }, errors };
}
