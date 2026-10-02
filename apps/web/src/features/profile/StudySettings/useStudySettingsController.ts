import {
  queryKeys,
  useInterests,
  usePlan,
  useProfile,
  useRebuildPlan,
  useReplaceInterests,
  useUpdateProfile,
} from '@english-saas/api-client';
import {
  CEFR_LEVELS,
  CEFR_LEVEL_LABELS,
  LEARNING_GOALS,
  LEARNING_GOAL_LABELS,
  PREFERRED_STUDY_TIMES,
  PREFERRED_STUDY_TIME_LABELS,
  type LearningGoal,
} from '@english-saas/shared';
import { toast } from '@english-saas/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { addDays, todayInTimezone } from '../lib/dates';
import {
  diffStudySettings,
  formFromServer,
  weeklyMinutes,
  type StudyForm,
} from '../lib/study-settings';

const ZERO_WEEK = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };

export function useStudySettingsController() {
  const queryClient = useQueryClient();
  const profile = useProfile();
  const interests = useInterests();
  // 404 quando ainda não há plano: o nível-alvo cai no padrão (C1).
  const plan = usePlan();
  const updateProfile = useUpdateProfile();
  const replaceInterests = useReplaceInterests();
  const rebuildPlan = useRebuildPlan();

  // O que a pessoa mexeu; o resto vem do servidor.
  const [draft, setDraft] = useState<Partial<StudyForm>>({});
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const server =
    profile.data && interests.data
      ? formFromServer({
          profile: profile.data,
          interests: interests.data,
          targetLevel: plan.data?.targetLevel ?? null,
        })
      : null;
  const form: StudyForm | null = server ? { ...server, ...draft } : null;
  const changes = server && form ? diffStudySettings(server, form) : null;

  const timezone = profile.data?.timezone ?? 'America/Sao_Paulo';
  const minDate = addDays(todayInTimezone(new Date(), timezone), 1);

  // Só valida o que a pessoa mudou: uma data-alvo antiga que ela não tocou
  // não pode travar o resto.
  const targetDateError =
    form &&
    changes?.profile.targetDate !== undefined &&
    changes.profile.targetDate !== null &&
    form.targetDate < minDate
      ? t('profile.study.targetDatePast')
      : undefined;
  const goalsError =
    form && form.goals.length === 0 ? t('profile.study.goalsEmpty') : undefined;
  const totalMinutes = form ? weeklyMinutes(form.availabilityMinutes) : 0;
  const isValid =
    goalsError === undefined &&
    targetDateError === undefined &&
    totalMinutes > 0;
  const isSaving =
    updateProfile.isPending ||
    replaceInterests.isPending ||
    rebuildPlan.isPending;

  function setField<K extends keyof StudyForm>(key: K, value: StudyForm[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleGoal(goal: LearningGoal) {
    if (form === null) {
      return;
    }

    setField(
      'goals',
      form.goals.includes(goal)
        ? form.goals.filter((item) => item !== goal)
        : [...form.goals, goal],
    );
  }

  function applyDaily(minutes: number) {
    setField('availabilityMinutes', {
      mon: minutes,
      tue: minutes,
      wed: minutes,
      thu: minutes,
      fri: minutes,
      sat: minutes,
      sun: minutes,
    });
  }

  function applyWeekdays(minutes: number) {
    setField('availabilityMinutes', {
      ...ZERO_WEEK,
      mon: minutes,
      tue: minutes,
      wed: minutes,
      thu: minutes,
      fri: minutes,
    });
  }

  async function performSave() {
    if (changes === null) {
      return;
    }

    setSaveError(null);
    let applied = 0;

    try {
      if (Object.keys(changes.profile).length > 0) {
        await updateProfile.mutateAsync(changes.profile);
        applied += 1;
      }

      if (changes.interests !== null) {
        await replaceInterests.mutateAsync(changes.interests);
        applied += 1;
      }

      if (changes.targetLevel !== null) {
        await rebuildPlan.mutateAsync({ targetLevel: changes.targetLevel });
        applied += 1;
      }

      setDraft({});
      toast.success({
        title: changes.replansPlan
          ? t('profile.study.savedReplan')
          : t('profile.study.saved'),
      });
    } catch {
      // O que já entrou fica no servidor; a tela só vai mostrar o que falta.
      setSaveError(
        applied > 0
          ? t('profile.study.partialError')
          : t('profile.study.saveError'),
      );
    } finally {
      setConfirmOpen(false);

      // O plano muda por trás (o planner recalcula em segundo plano).
      void queryClient.invalidateQueries({ queryKey: queryKeys.mePlan });
      void queryClient.invalidateQueries({ queryKey: queryKeys.meAgenda });
    }
  }

  function requestSave() {
    if (changes === null || !changes.hasChanges || !isValid) {
      return;
    }

    if (changes.replansPlan) {
      setConfirmOpen(true);
      return;
    }

    void performSave();
  }

  return {
    isLoading: profile.isLoading || interests.isLoading || plan.isLoading,
    isError: profile.isError || interests.isError,
    retry: () => {
      void profile.refetch();
      void interests.refetch();
    },
    form,
    goalOptions: LEARNING_GOALS.map((goal) => ({
      value: goal,
      label: LEARNING_GOAL_LABELS[goal],
    })),
    studyTimeOptions: PREFERRED_STUDY_TIMES.map((value) => ({
      value,
      label: PREFERRED_STUDY_TIME_LABELS[value],
    })),
    levelOptions: CEFR_LEVELS.map((level) => ({
      value: level,
      label: `${level} · ${CEFR_LEVEL_LABELS[level]}`,
    })),
    setField,
    toggleGoal,
    applyDaily,
    applyWeekdays,
    totalMinutes,
    goalsError,
    targetDateError,
    minDate,
    canSave: changes?.hasChanges === true && isValid && !isSaving,
    isSaving,
    requestSave,
    saveError,
    isConfirmOpen,
    confirmSave: () => void performSave(),
    closeConfirm: () => setConfirmOpen(false),
  };
}
