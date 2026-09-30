import {
  useCheckout,
  usePollSubscription,
  type BillingPeriod,
  type PaymentMethod,
} from '@english-saas/api-client';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type CheckoutPhase =
  'FORM' | 'PREPARING' | 'WAITING_PAYMENT' | 'SUCCESS' | 'FAILED';

type CheckoutParams = { tier: 'BASE' | 'PLUS'; billingPeriod: BillingPeriod };

function readParams(state: unknown): CheckoutParams | null {
  if (
    typeof state === 'object' &&
    state !== null &&
    'tier' in state &&
    'billingPeriod' in state &&
    (state.tier === 'BASE' || state.tier === 'PLUS')
  ) {
    return state as CheckoutParams;
  }

  return null;
}

export function useCheckoutController() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = readParams(location.state);

  const checkout = useCheckout();
  const [phase, setPhase] = useState<CheckoutPhase>('FORM');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const preparing = usePollSubscription(
    (overview) => overview.subscription?.checkoutUrl !== null,
    phase === 'PREPARING',
  );

  const waiting = usePollSubscription(
    (overview) => overview.subscription?.status !== 'PENDING',
    phase === 'WAITING_PAYMENT',
  );

  const preparedUrl = preparing.data?.subscription?.checkoutUrl ?? null;

  useEffect(() => {
    if (phase !== 'PREPARING' || preparedUrl === null) {
      return;
    }

    setCheckoutUrl(preparedUrl);
    setPhase('WAITING_PAYMENT');
    window.open(preparedUrl, '_blank', 'noopener,noreferrer');
  }, [phase, preparedUrl]);

  const waitingStatus = waiting.data?.subscription?.status;

  useEffect(() => {
    if (phase !== 'WAITING_PAYMENT' || waitingStatus === undefined) {
      return;
    }

    if (waitingStatus === 'ACTIVE' || waitingStatus === 'PAST_DUE') {
      setPhase('SUCCESS');
    } else if (waitingStatus === 'EXPIRED' || waitingStatus === 'CANCELED') {
      setPhase('FAILED');
    }
  }, [phase, waitingStatus]);

  async function submit() {
    if (params === null) {
      return;
    }

    await checkout.mutateAsync({
      tier: params.tier,
      billingPeriod: params.billingPeriod,
      paymentMethod,
      cpfCnpj: cpfCnpj.trim() === '' ? undefined : cpfCnpj.trim(),
    });
    setPhase('PREPARING');
  }

  return {
    params,
    phase,
    paymentMethod,
    onPaymentMethodChange: setPaymentMethod,
    cpfCnpj,
    onCpfCnpjChange: setCpfCnpj,
    onSubmit: () => void submit(),
    isSubmitting: checkout.isPending,
    submitError: checkout.error,
    checkoutUrl,
    reopenCheckoutUrl: () => {
      if (checkoutUrl !== null) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      }
    },
    waitingMessage: waiting.data?.message ?? null,
    goToPlans: () => navigate('/planos'),
    goToSubscription: () => navigate('/minha-assinatura'),
  };
}
