import {
  LEARNING_GOALS,
  LEARNING_GOAL_LABELS,
  type LearningGoal,
} from '@english-saas/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOnboardingWizardStore } from '../../../stores/onboarding-wizard-store';

export function useGoalController() {
  const navigate = useNavigate();
  const goals = useOnboardingWizardStore((state) => state.goals);
  const goalNote = useOnboardingWizardStore((state) => state.goalNote);
  const setGoals = useOnboardingWizardStore((state) => state.setGoals);
  const setGoalNote = useOnboardingWizardStore((state) => state.setGoalNote);

  const [localGoals, setLocalGoals] = useState<LearningGoal[]>(goals);
  const [localNote, setLocalNote] = useState(goalNote);

  function toggleGoal(goal: LearningGoal) {
    setLocalGoals((current) =>
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal],
    );
  }

  function handleContinue() {
    if (localGoals.length === 0) {
      return;
    }

    setGoals(localGoals);
    setGoalNote(localNote);
    navigate('/onboarding/tempo');
  }

  return {
    options: LEARNING_GOALS.map((goal) => ({
      value: goal,
      label: LEARNING_GOAL_LABELS[goal],
    })),
    selectedGoals: localGoals,
    toggleGoal,
    showNote: localGoals.includes('OTHER'),
    note: localNote,
    setNote: setLocalNote,
    canContinue: localGoals.length > 0,
    handleContinue,
  };
}
