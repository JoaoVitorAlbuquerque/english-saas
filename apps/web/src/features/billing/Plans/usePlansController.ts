import {
  usePlans,
  useSubscription,
  type BillingPeriod,
  type PlanTier,
  type PlanView,
} from '@english-saas/api-client';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function usePlansController() {
  const plans = usePlans();
  const subscription = useSubscription();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<BillingPeriod>('MONTHLY');

  const free = (plans.data ?? []).find((plan) => plan.tier === 'FREE');
  const base = (plans.data ?? []).find(
    (plan) => plan.tier === 'BASE' && plan.billingPeriod === period,
  );
  const plus = (plans.data ?? []).find(
    (plan) => plan.tier === 'PLUS' && plan.billingPeriod === period,
  );

  const currentTier: PlanTier = subscription.data?.tier ?? 'FREE';

  function subscribeTo(plan: PlanView) {
    if (plan.billingPeriod === null) {
      return;
    }

    navigate('/checkout', {
      state: { tier: plan.tier, billingPeriod: plan.billingPeriod },
    });
  }

  return {
    isLoading: plans.isLoading,
    isError: plans.isError,
    retry: () => void plans.refetch(),
    period,
    onPeriodChange: setPeriod,
    free,
    base,
    plus,
    currentTier,
    subscribeTo,
  };
}
