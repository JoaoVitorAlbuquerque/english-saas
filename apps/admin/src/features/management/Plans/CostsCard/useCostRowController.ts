import {
  CREDIT_COST_MAX,
  CREDIT_COST_MIN,
  useUpdateCreditCost,
  type ApiError,
  type CreditFeatureName,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../../messages/pt-BR';

/** O custo digitado vira inteiro de 1 a 100 (o mesmo limite da API). */
export function parseCost(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }

  const value = Number(text.trim());

  return value >= CREDIT_COST_MIN && value <= CREDIT_COST_MAX ? value : null;
}

export function useCostRowController(
  feature: CreditFeatureName,
  current: number,
) {
  const [text, setText] = useState(String(current));
  const [attempted, setAttempted] = useState(false);
  const update = useUpdateCreditCost();

  const parsed = parseCost(text);
  const changed = text.trim() !== String(current);

  function save(): void {
    setAttempted(true);

    if (parsed === null || parsed === current) {
      return;
    }

    update.mutate(
      { feature, cost: parsed },
      {
        onSuccess: () => toast.success({ title: t('costs.saved') }),
        onError: (error: ApiError) =>
          toast.error({
            title: t('costs.saveError'),
            description: error.message,
          }),
      },
    );
  }

  return {
    text,
    setText,
    error:
      attempted && parsed === null
        ? t('costs.invalid', { min: CREDIT_COST_MIN, max: CREDIT_COST_MAX })
        : undefined,
    changed,
    save,
    isSaving: update.isPending,
  };
}
