import {
  PREFERRED_STUDY_TIMES,
  PREFERRED_STUDY_TIME_LABELS,
  WEEKDAYS,
  type AvailabilityMinutes,
  type PreferredStudyTime,
} from '@english-saas/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  EMPTY_AVAILABILITY,
  useOnboardingWizardStore,
} from '../../../stores/onboarding-wizard-store';

export function useAvailabilityController() {
  const navigate = useNavigate();
  const availabilityMinutes = useOnboardingWizardStore(
    (state) => state.availabilityMinutes,
  );
  const preferredStudyTime = useOnboardingWizardStore(
    (state) => state.preferredStudyTime,
  );
  const setAvailability = useOnboardingWizardStore(
    (state) => state.setAvailability,
  );
  const setPreferredStudyTime = useOnboardingWizardStore(
    (state) => state.setPreferredStudyTime,
  );

  const [minutes, setMinutes] =
    useState<AvailabilityMinutes>(availabilityMinutes);
  const [studyTime, setStudyTime] =
    useState<PreferredStudyTime>(preferredStudyTime);

  const totalWeeklyMinutes = WEEKDAYS.reduce(
    (sum, day) => sum + minutes[day],
    0,
  );

  function applyDaily(value: number) {
    setMinutes({
      ...EMPTY_AVAILABILITY,
      mon: value,
      tue: value,
      wed: value,
      thu: value,
      fri: value,
      sat: value,
      sun: value,
    });
  }

  function applyWeekdays(value: number) {
    setMinutes({
      ...EMPTY_AVAILABILITY,
      mon: value,
      tue: value,
      wed: value,
      thu: value,
      fri: value,
    });
  }

  function handleContinue() {
    if (totalWeeklyMinutes === 0) {
      return;
    }

    setAvailability(minutes);
    setPreferredStudyTime(studyTime);
    navigate('/onboarding/interesses');
  }

  return {
    minutes,
    setMinutes,
    studyTimeOptions: PREFERRED_STUDY_TIMES.map((value) => ({
      value,
      label: PREFERRED_STUDY_TIME_LABELS[value],
    })),
    studyTime,
    setStudyTime,
    applyDaily,
    applyWeekdays,
    totalWeeklyMinutes,
    canContinue: totalWeeklyMinutes > 0,
    handleContinue,
  };
}
