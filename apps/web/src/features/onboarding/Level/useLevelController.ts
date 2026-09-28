import {
  SELF_REPORTED_LEVELS,
  SELF_REPORTED_LEVEL_LABELS,
  type SelfReportedLevel,
} from '@english-saas/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOnboardingWizardStore } from '../../../stores/onboarding-wizard-store';
import { t } from '../../../messages/pt-BR';

const LEVEL_TITLE_KEYS: Record<SelfReportedLevel, Parameters<typeof t>[0]> = {
  NONE: 'onboarding.step.level.NONE.title',
  BASIC: 'onboarding.step.level.BASIC.title',
  INTERMEDIATE: 'onboarding.step.level.INTERMEDIATE.title',
  ADVANCED: 'onboarding.step.level.ADVANCED.title',
};

export function useLevelController() {
  const navigate = useNavigate();
  const selfReportedLevel = useOnboardingWizardStore(
    (state) => state.selfReportedLevel,
  );
  const setSelfReportedLevel = useOnboardingWizardStore(
    (state) => state.setSelfReportedLevel,
  );

  const [selected, setSelected] = useState<SelfReportedLevel | null>(
    selfReportedLevel,
  );

  function handleContinue() {
    if (!selected) {
      return;
    }

    setSelfReportedLevel(selected);
    navigate('/onboarding/consentimentos');
  }

  return {
    options: SELF_REPORTED_LEVELS.map((level) => ({
      value: level,
      title: t(LEVEL_TITLE_KEYS[level]),
      description: SELF_REPORTED_LEVEL_LABELS[level],
    })),
    selected,
    setSelected,
    canContinue: selected !== null,
    handleContinue,
  };
}
