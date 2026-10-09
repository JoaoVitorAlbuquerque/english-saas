import {
  useUpdatePlan,
  type ApiError,
  type PlanView,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { draftOf, planPatch, type PlanDraft } from '../lib/plan-form';

/**
 * Uma linha da tabela de planos: o que está sendo digitado e o salvar. A linha
 * é montada com `key` que inclui os valores do servidor, então depois de salvar
 * ela recomeça já refletindo o que ficou gravado.
 */
export function usePlanRowController(plan: PlanView) {
  const [draft, setDraft] = useState<PlanDraft>(draftOf(plan));
  const [attempted, setAttempted] = useState(false);
  const update = useUpdatePlan();

  const result = planPatch(plan, draft);

  function save(): void {
    setAttempted(true);

    if (result.patch === null) {
      return;
    }

    update.mutate(
      { id: plan.id, patch: result.patch },
      {
        onSuccess: () => toast.success({ title: t('plans.saved') }),
        onError: (error: ApiError) =>
          toast.error({
            title: t('plans.saveError'),
            description: error.message,
          }),
      },
    );
  }

  return {
    draft,
    setField: <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) =>
      setDraft((current) => ({ ...current, [key]: value })),
    errors: {
      price:
        attempted && result.errors.price
          ? t(`plans.error.${result.errors.price}`)
          : undefined,
      credits:
        attempted && result.errors.credits
          ? t(`plans.error.${result.errors.credits}`)
          : undefined,
    },
    changed: result.patch !== null || Object.keys(result.errors).length > 0,
    save,
    isSaving: update.isPending,
  };
}
