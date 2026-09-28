import { Button, Chip, Textarea } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useGoalController } from './useGoalController';

export function Goal() {
  const {
    options,
    selectedGoals,
    toggleGoal,
    showNote,
    note,
    setNote,
    canContinue,
    handleContinue,
  } = useGoalController();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">
          {t('onboarding.step.goal.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('onboarding.step.goal.description')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            selected={selectedGoals.includes(option.value)}
            onClick={() => toggleGoal(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      {showNote ? (
        <Textarea
          label={t('onboarding.step.goal.noteLabel')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      ) : null}

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
