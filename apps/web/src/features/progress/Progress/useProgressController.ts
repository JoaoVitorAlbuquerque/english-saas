import {
  PROGRESS_WEEKS_DEFAULT,
  useLearnerProfile,
  useProgress,
  type PaceStatus,
} from '@english-saas/api-client';
import {
  COMPETENCIES,
  COMPETENCY_LABELS,
  type Competency,
} from '@english-saas/shared';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { formatDate, formatWeek } from '../lib/format-date';
import { examplesFor } from '../lib/join-error-examples';
import { isNewStudent } from '../lib/is-new-student';
import {
  competencyBars,
  levelPoints,
  type EvolutionFocus,
} from '../lib/level-scale';
import { weaknessLink } from '../lib/weakness-action';

/** Períodos que o seletor oferece — todos dentro de 4–26 que a API aceita. */
export const PERIOD_OPTIONS = [4, 8, 12, 26] as const;

const FORECAST_LABELS: Record<PaceStatus, string> = {
  ON_TRACK: t('progress.forecast.ON_TRACK'),
  AHEAD: t('progress.forecast.AHEAD'),
  BEHIND: t('progress.forecast.BEHIND'),
  TOO_EARLY: t('progress.forecast.TOO_EARLY'),
  NO_STUDY: t('progress.forecast.NO_STUDY'),
  NO_PLAN: t('progress.forecast.NO_PLAN'),
};

export function useProgressController() {
  const [weeks, setWeeks] = useState<number>(PROGRESS_WEEKS_DEFAULT);
  const [focus, setFocus] = useState<EvolutionFocus>('OVERALL');
  const progressQuery = useProgress(weeks);
  // Só traz as frases do aluno para os erros: se falhar, a tela segue sem elas.
  const learnerProfile = useLearnerProfile();

  const progress = progressQuery.data;

  const base = {
    weeks,
    setWeeks,
    periodOptions: PERIOD_OPTIONS,
    isLoading: progress === undefined && progressQuery.isLoading,
    isError: progress === undefined && progressQuery.isError,
    retry: () => void progressQuery.refetch(),
  };

  if (progress === undefined) {
    return { ...base, view: null };
  }

  const focusOptions: { value: EvolutionFocus; label: string }[] = [
    { value: 'OVERALL', label: t('progress.evolution.overall') },
    ...COMPETENCIES.map((competency: Competency) => ({
      value: competency as EvolutionFocus,
      label: COMPETENCY_LABELS[competency],
    })),
  ];
  const { forecast } = progress;

  return {
    ...base,
    view: {
      isNewStudent: isNewStudent(progress),
      isRefreshing: progressQuery.isPlaceholderData,

      overall: progress.level.overall,
      levelBars: competencyBars(
        progress.level.competencies,
        t('progress.level.lowConfidence'),
      ),

      evolution: {
        focus,
        setFocus,
        focusOptions,
        points: levelPoints(progress.level.weekly, focus),
        targetLevel: forecast.targetLevel,
        seriesLabel:
          focusOptions.find((option) => option.value === focus)?.label ?? '',
      },

      forecast: {
        message: forecast.message,
        statusLabel: FORECAST_LABELS[forecast.status],
        status: forecast.status,
        targetLevel: forecast.targetLevel,
        byPlan: forecast.byPlan === null ? null : formatDate(forecast.byPlan),
        byPace: forecast.byPace === null ? null : formatDate(forecast.byPace),
      },

      strengths: progress.strengths,
      weaknesses: progress.weaknesses.map((weakness) => ({
        skillId: weakness.skillId,
        title: weakness.title,
        text: weakness.text,
        link: weaknessLink(weakness.action),
      })),

      errors: progress.stats.topErrors.map((error) => ({
        id: error.errorPatternId,
        description: error.description,
        correction: error.correction,
        occurrences: error.recentOccurrences,
        opportunities: error.opportunities,
        trend: error.trend,
        trendLabel: error.trendLabel,
        examples: examplesFor(error.errorPatternId, learnerProfile.data),
      })),

      plan: {
        weeks: progress.plan.weeks.map((week) => ({
          id: week.weekStart,
          label: formatWeek(week.weekStart),
          planned: week.plannedMinutes,
          done: week.studiedMinutes,
        })),
        hasAnyPlan: progress.plan.weeks.some((week) => week.plannedMinutes > 0),
      },

      stats: {
        minutesStudied: progress.stats.minutesStudied,
        lessonsCompleted: progress.stats.lessonsCompleted,
        reviewsDone: progress.stats.reviewsDone,
        currentStreak: progress.stats.currentStreak,
        longestStreak: progress.stats.longestStreak,
      },
    },
  };
}

export type ProgressView = NonNullable<
  ReturnType<typeof useProgressController>['view']
>;
