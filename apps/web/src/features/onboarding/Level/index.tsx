import { Button, Card, cn } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useLevelController } from './useLevelController';

export function Level() {
  const { options, selected, setSelected, canContinue, handleContinue } =
    useLevelController();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">
          {t('onboarding.step.level.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('onboarding.step.level.description')}
        </p>
      </div>

      <div role="radiogroup" className="flex flex-col gap-3">
        {options.map((option) => (
          <Card
            key={option.value}
            role="radio"
            aria-checked={selected === option.value}
            tabIndex={0}
            onClick={() => setSelected(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelected(option.value);
              }
            }}
            className={cn(
              'cursor-pointer transition-colors',
              selected === option.value
                ? 'border-accent bg-accent/5'
                : 'hover:bg-ground',
            )}
          >
            <p className="font-medium text-ink">{option.title}</p>
            <p className="mt-0.5 text-sm text-muted">{option.description}</p>
          </Card>
        ))}
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
