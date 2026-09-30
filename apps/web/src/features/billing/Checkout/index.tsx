import type { PaymentMethod } from '@english-saas/api-client';
import { Button, Chip, EmptyState, Input, Skeleton } from '@english-saas/ui';
import { CheckCircle2, XCircle } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { useCheckoutController } from './useCheckoutController';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
];

export function Checkout() {
  const {
    params,
    phase,
    paymentMethod,
    onPaymentMethodChange,
    cpfCnpj,
    onCpfCnpjChange,
    onSubmit,
    isSubmitting,
    submitError,
    reopenCheckoutUrl,
    waitingMessage,
    goToPlans,
    goToSubscription,
  } = useCheckoutController();

  if (params === null) {
    return (
      <EmptyState
        title={t('checkout.noParamsTitle')}
        description={t('checkout.noParamsDescription')}
        action={
          <Button onClick={goToPlans}>{t('checkout.backToPlans')}</Button>
        }
      />
    );
  }

  if (phase === 'FORM') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="font-display text-xl text-ink">{t('checkout.title')}</h1>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">
            {t('checkout.paymentMethod')}
          </span>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <Chip
                key={method.value}
                selected={paymentMethod === method.value}
                onClick={() => onPaymentMethodChange(method.value)}
              >
                {method.label}
              </Chip>
            ))}
          </div>
        </div>

        <Input
          label={t('checkout.cpfCnpj')}
          hint={t('checkout.cpfCnpjHint')}
          value={cpfCnpj}
          onChange={(event) => onCpfCnpjChange(event.target.value)}
          inputMode="numeric"
        />

        {submitError ? (
          <p role="alert" className="text-sm text-error">
            {submitError.message}
          </p>
        ) : null}

        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          {t('checkout.submit')}
        </Button>
      </div>
    );
  }

  if (phase === 'PREPARING') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Skeleton className="h-6 w-48" />
        <p className="text-sm text-muted">{t('checkout.preparing')}</p>
      </div>
    );
  }

  if (phase === 'WAITING_PAYMENT') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <h1 className="font-display text-lg text-ink">
          {t('checkout.waitingTitle')}
        </h1>
        <p className="max-w-sm text-sm text-muted">
          {waitingMessage ?? t('checkout.waitingDescription')}
        </p>
        <Button variant="ghost" onClick={reopenCheckoutUrl}>
          {t('checkout.reopenLink')}
        </Button>
      </div>
    );
  }

  if (phase === 'SUCCESS') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 className="size-12 text-ok" aria-hidden="true" />
        <h1 className="font-display text-lg text-ink">
          {t('checkout.successTitle')}
        </h1>
        <p className="max-w-sm text-sm text-muted">
          {t('checkout.successDescription')}
        </p>
        <Button onClick={goToSubscription}>
          {t('checkout.goToSubscription')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <XCircle className="size-12 text-error" aria-hidden="true" />
      <h1 className="font-display text-lg text-ink">
        {t('checkout.failedTitle')}
      </h1>
      <p className="max-w-sm text-sm text-muted">
        {t('checkout.failedDescription')}
      </p>
      <Button onClick={goToPlans}>{t('checkout.backToPlans')}</Button>
    </div>
  );
}
