import {
  BONUS_LIMITS,
  useGrantBonus,
  type ApiError,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../../messages/pt-BR';
import { validateGrant, type GrantFieldError } from '../../lib/grant-form';

export function grantErrorText(error: GrantFieldError): string {
  switch (error) {
    case 'AMOUNT_INVALID':
      return t('student.grant.AMOUNT_INVALID');
    case 'AMOUNT_OUT_OF_RANGE':
      return t('student.grant.AMOUNT_OUT_OF_RANGE', {
        min: BONUS_LIMITS.amountMin,
        max: BONUS_LIMITS.amountMax,
      });
    case 'REASON_REQUIRED':
      return t('student.grant.REASON_REQUIRED');
    case 'REASON_TOO_LONG':
      return t('student.grant.REASON_TOO_LONG', {
        max: BONUS_LIMITS.reasonMax,
      });
  }
}

export function useGrantController(input: {
  userId: string;
  balance: number | undefined;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  // Os erros só aparecem depois da primeira tentativa: o campo vazio não grita.
  const [attempted, setAttempted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const grant = useGrantBonus(input.userId);

  const result = validateGrant({ amount, reason });

  function reset(): void {
    setAmount('');
    setReason('');
    setAttempted(false);
    setApiError(null);
  }

  function close(): void {
    reset();
    input.onClose();
  }

  function submit(): void {
    setAttempted(true);
    setApiError(null);

    if (result.value === null) {
      return;
    }

    grant.mutate(result.value, {
      onSuccess: ({ balance }) => {
        toast.success({ title: t('student.grant.success', { balance }) });
        close();
      },
      onError: (error: ApiError) => setApiError(error.message),
    });
  }

  return {
    amount,
    reason,
    setAmount,
    setReason,
    errors: {
      amount:
        attempted && result.errors.amount
          ? grantErrorText(result.errors.amount)
          : undefined,
      reason:
        attempted && result.errors.reason
          ? grantErrorText(result.errors.reason)
          : undefined,
    },
    /** O saldo depois do bônus, quando a quantidade já é válida. */
    balanceAfter:
      input.balance !== undefined && result.value !== null
        ? input.balance + result.value.amount
        : null,
    apiError,
    isSubmitting: grant.isPending,
    submit,
    close,
  };
}
