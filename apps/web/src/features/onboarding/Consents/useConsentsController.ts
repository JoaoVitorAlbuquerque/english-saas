import {
  useCompleteOnboarding,
  useUpdateConsent,
} from '@english-saas/api-client';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useOnboardingWizardStore } from '../../../stores/onboarding-wizard-store';

export function useConsentsController() {
  const navigate = useNavigate();
  const wizard = useOnboardingWizardStore((state) => state);
  const updateConsent = useUpdateConsent();
  const completeOnboarding = useCompleteOnboarding();

  const [personalization, setPersonalization] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSubmitting = updateConsent.isPending || completeOnboarding.isPending;

  async function handleSubmit() {
    if (!personalization || !wizard.selfReportedLevel) {
      return;
    }

    setSubmitError(null);

    try {
      await Promise.all([
        updateConsent.mutateAsync({
          type: 'DATA_PERSONALIZATION',
          granted: true,
        }),
        updateConsent.mutateAsync({ type: 'MARKETING', granted: marketing }),
      ]);

      await completeOnboarding.mutateAsync({
        goals: wizard.goals,
        goalNote:
          wizard.goalNote.trim().length > 0 ? wizard.goalNote.trim() : null,
        availabilityMinutes: wizard.availabilityMinutes,
        preferredStudyTime: wizard.preferredStudyTime,
        selfReportedLevel: wizard.selfReportedLevel,
        interests: wizard.interests,
      });

      wizard.reset();
      navigate('/onboarding/final', { replace: true });
    } catch {
      setSubmitError(t('onboarding.step.consents.error'));
    }
  }

  return {
    personalization,
    setPersonalization,
    marketing,
    setMarketing,
    canSubmit: personalization,
    isSubmitting,
    errorMessage: submitError,
    handleSubmit,
  };
}
