import { Button, Chip, Input } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useInterestsController } from './useInterestsController';

export function Interests() {
  const {
    search,
    setSearch,
    selected,
    suggestions,
    addInterest,
    removeInterest,
    canAddCustom,
    handleContinue,
  } = useInterestsController();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">
          {t('onboarding.step.interests.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('onboarding.step.interests.description')}
        </p>
      </div>

      <Input
        placeholder={t('onboarding.step.interests.search')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {selected.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {t('onboarding.step.interests.selected')}
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.map((interest) => (
              <Chip
                key={interest.topic}
                selected
                onClick={() => removeInterest(interest.topic)}
              >
                {interest.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-ink">
          {t('onboarding.step.interests.suggestions')}
        </p>
        <div className="flex flex-wrap gap-2">
          {canAddCustom ? (
            <Chip onClick={() => addInterest(search)}>
              {t('onboarding.step.interests.addCustom')} "{search.trim()}"
            </Chip>
          ) : null}
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion.topic}
              onClick={() => addInterest(suggestion.topic)}
            >
              {suggestion.label}
            </Chip>
          ))}
          {suggestions.length === 0 && !canAddCustom ? (
            <p className="text-sm text-muted">
              {t('onboarding.step.interests.empty')}
            </p>
          ) : null}
        </div>
      </div>

      <Button className="mt-auto" onClick={handleContinue}>
        {t('onboarding.continue')}
      </Button>
    </div>
  );
}
