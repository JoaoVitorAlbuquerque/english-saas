import {
  Button,
  Card,
  Chip,
  ErrorState,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@english-saas/ui';

import { InterestPicker } from '../../../components/InterestPicker';
import { WeekdayMinutesGrid } from '../../../components/WeekdayMinutesGrid';
import { t } from '../../../messages/pt-BR';
import { BackToProfile } from '../components/BackToProfile';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStudySettingsController } from './useStudySettingsController';

export function StudySettings() {
  const {
    isLoading,
    isError,
    retry,
    form,
    goalOptions,
    studyTimeOptions,
    levelOptions,
    setField,
    toggleGoal,
    applyDaily,
    applyWeekdays,
    totalMinutes,
    goalsError,
    targetDateError,
    minDate,
    canSave,
    isSaving,
    requestSave,
    saveError,
    isConfirmOpen,
    confirmSave,
    closeConfirm,
  } = useStudySettingsController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || form === null) {
    return (
      <div className="flex flex-col gap-4">
        <BackToProfile />
        <ErrorState title={t('profile.study.errorTitle')} onRetry={retry} />
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        requestSave();
      }}
      noValidate
    >
      <BackToProfile />
      <h1 className="font-display text-xl text-ink">
        {t('profile.study.title')}
      </h1>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-ink">
          {t('profile.study.goalsTitle')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((option) => (
            <Chip
              key={option.value}
              selected={form.goals.includes(option.value)}
              onClick={() => toggleGoal(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        {goalsError ? (
          <p role="alert" className="text-sm text-error">
            {goalsError}
          </p>
        ) : null}
        {form.goals.includes('OTHER') ? (
          <Textarea
            label={t('onboarding.step.goal.noteLabel')}
            value={form.goalNote}
            maxLength={500}
            onChange={(event) => setField('goalNote', event.target.value)}
          />
        ) : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-ink">
            {t('profile.study.availabilityTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('profile.study.availabilityDescription')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip onClick={() => applyDaily(10)}>
            {t('onboarding.step.availability.shortcutDaily')}
          </Chip>
          <Chip onClick={() => applyWeekdays(20)}>
            {t('onboarding.step.availability.shortcutWeekdays')}
          </Chip>
        </div>

        <WeekdayMinutesGrid
          value={form.availabilityMinutes}
          onChange={(next) => setField('availabilityMinutes', next)}
        />

        {totalMinutes === 0 ? (
          <p role="alert" className="text-sm text-error">
            {t('onboarding.step.availability.zeroHint')}
          </p>
        ) : (
          <p className="text-sm text-muted">
            {t('profile.study.weeklyTotal', { minutes: totalMinutes })}
          </p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {t('onboarding.step.availability.preferredTime')}
          </p>
          <div className="flex flex-wrap gap-2">
            {studyTimeOptions.map((option) => (
              <Chip
                key={option.value}
                selected={form.preferredStudyTime === option.value}
                onClick={() => setField('preferredStudyTime', option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-ink">
          {t('profile.study.targetTitle')}
        </h2>
        <Select
          label={t('profile.study.targetLevel')}
          value={form.targetLevel}
          options={levelOptions}
          onChange={(event) =>
            setField(
              'targetLevel',
              event.target.value as (typeof levelOptions)[number]['value'],
            )
          }
        />
        <div className="flex flex-col gap-2">
          <Input
            type="date"
            label={t('profile.study.targetDate')}
            value={form.targetDate}
            min={minDate}
            hint={t('profile.study.targetDateHint')}
            error={targetDateError}
            onChange={(event) => setField('targetDate', event.target.value)}
          />
          {form.targetDate !== '' ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setField('targetDate', '')}
            >
              {t('profile.study.targetDateClear')}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-ink">
            {t('profile.study.interestsTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('profile.study.interestsDescription')}
          </p>
        </div>
        <InterestPicker
          value={form.interests}
          onChange={(next) => setField('interests', next)}
        />
      </Card>

      {saveError ? (
        <p role="alert" className="text-sm text-error">
          {saveError}
        </p>
      ) : null}

      <Button
        type="submit"
        className="self-start"
        disabled={!canSave}
        isLoading={isSaving}
      >
        {t('profile.study.save')}
      </Button>

      <ConfirmDialog
        open={isConfirmOpen}
        title={t('profile.study.replanTitle')}
        description={t('profile.study.replanDescription')}
        confirmLabel={t('profile.study.replanConfirm')}
        cancelLabel={t('profile.study.replanBack')}
        isLoading={isSaving}
        onConfirm={confirmSave}
        onClose={closeConfirm}
      />
    </form>
  );
}
