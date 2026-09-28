import { Button, Checkbox } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useConsentsController } from './useConsentsController';

export function Consents() {
  const {
    personalization,
    setPersonalization,
    marketing,
    setMarketing,
    canSubmit,
    isSubmitting,
    errorMessage,
    handleSubmit,
  } = useConsentsController();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">
          {t('onboarding.step.consents.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('onboarding.step.consents.description')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Checkbox
          label={t('onboarding.step.consents.personalization')}
          checked={personalization}
          onCheckedChange={setPersonalization}
        />
        <p className="pl-8 text-xs text-muted">
          {t('onboarding.step.consents.personalizationRequired')}
        </p>
      </div>

      <Checkbox
        label={t('onboarding.step.consents.marketing')}
        checked={marketing}
        onCheckedChange={setMarketing}
      />

      {errorMessage ? (
        <p role="alert" className="text-sm text-error">
          {errorMessage}
        </p>
      ) : null}

      <Button
        className="mt-auto"
        disabled={!canSubmit}
        isLoading={isSubmitting}
        onClick={() => void handleSubmit()}
      >
        {t('onboarding.step.consents.submit')}
      </Button>
    </div>
  );
}
