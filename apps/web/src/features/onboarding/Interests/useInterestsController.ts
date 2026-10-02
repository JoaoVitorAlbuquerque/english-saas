import type { Interest } from '@english-saas/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOnboardingWizardStore } from '../../../stores/onboarding-wizard-store';

export function useInterestsController() {
  const navigate = useNavigate();
  const interests = useOnboardingWizardStore((state) => state.interests);
  const setInterests = useOnboardingWizardStore((state) => state.setInterests);

  const [selected, setSelected] = useState<Interest[]>(interests);

  function handleContinue() {
    setInterests(selected);
    navigate('/onboarding/nivel');
  }

  return { selected, setSelected, handleContinue };
}
