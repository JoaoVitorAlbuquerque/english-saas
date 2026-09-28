import type {
  AvailabilityMinutes,
  Interest,
  LearningGoal,
  PreferredStudyTime,
  SelfReportedLevel,
} from '@english-saas/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type OnboardingWizardValues = {
  goals: LearningGoal[];
  goalNote: string;
  availabilityMinutes: AvailabilityMinutes;
  preferredStudyTime: PreferredStudyTime;
  interests: Interest[];
  selfReportedLevel: SelfReportedLevel | null;
};

type OnboardingWizardState = OnboardingWizardValues & {
  setGoals: (goals: LearningGoal[]) => void;
  setGoalNote: (goalNote: string) => void;
  setAvailability: (availabilityMinutes: AvailabilityMinutes) => void;
  setPreferredStudyTime: (preferredStudyTime: PreferredStudyTime) => void;
  setInterests: (interests: Interest[]) => void;
  setSelfReportedLevel: (selfReportedLevel: SelfReportedLevel) => void;
  reset: () => void;
};

export const EMPTY_AVAILABILITY: AvailabilityMinutes = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

const initialValues: OnboardingWizardValues = {
  goals: [],
  goalNote: '',
  availabilityMinutes: EMPTY_AVAILABILITY,
  preferredStudyTime: 'ANY',
  interests: [],
  selfReportedLevel: null,
};

/**
 * Respostas acumuladas do onboarding. `POST /me/onboarding` só existe para
 * salvar tudo de uma vez no fim — não há endpoint por etapa — então o wizard
 * guarda o progresso aqui. `sessionStorage` porque rede instável no celular
 * é premissa do projeto: perder as respostas por causa de um reload no meio
 * do fluxo seria ruim; não precisa sobreviver a fechar a aba.
 */
export const useOnboardingWizardStore = create<OnboardingWizardState>()(
  persist(
    (set) => ({
      ...initialValues,
      setGoals: (goals) => set({ goals }),
      setGoalNote: (goalNote) => set({ goalNote }),
      setAvailability: (availabilityMinutes) => set({ availabilityMinutes }),
      setPreferredStudyTime: (preferredStudyTime) =>
        set({ preferredStudyTime }),
      setInterests: (interests) => set({ interests }),
      setSelfReportedLevel: (selfReportedLevel) => set({ selfReportedLevel }),
      reset: () => set(initialValues),
    }),
    {
      name: 'english-saas:onboarding-wizard',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
