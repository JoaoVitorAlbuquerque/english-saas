import { Button, Chip } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useAvailabilityController } from './useAvailabilityController';
import { WeekdayMinutesGrid } from './WeekdayMinutesGrid';

export function Availability() {
  const {
    minutes,
    setMinutes,
    studyTimeOptions,
    studyTime,
    setStudyTime,
    applyDaily,
    applyWeekdays,
    totalWeeklyMinutes,
    canContinue,
    handleContinue,
  } = useAvailabilityController();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">
          {t('onboarding.step.availability.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('onboarding.step.availability.description')}
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

      <WeekdayMinutesGrid value={minutes} onChange={setMinutes} />

      {totalWeeklyMinutes === 0 ? (
        <p className="text-sm text-error">
          {t('onboarding.step.availability.zeroHint')}
        </p>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-ink">
          {t('onboarding.step.availability.preferredTime')}
        </p>
        <div className="flex flex-wrap gap-2">
          {studyTimeOptions.map((option) => (
            <Chip
              key={option.value}
              selected={studyTime === option.value}
              onClick={() => setStudyTime(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <Button
        className="mt-auto"
        disabled={!canContinue}
        onClick={handleContinue}
      >
        {t('onboarding.continue')}
      </Button>
    </div>
  );
}
