import type { Interest } from '@english-saas/shared';
import { Chip, Input } from '@english-saas/ui';

import { t } from '../../messages/pt-BR';
import { MAX_INTERESTS, useInterestPicker } from './useInterestPicker';

/** Escolha de temas de interesse — usada no onboarding e em Perfil → Estudo. */
export function InterestPicker({
  value,
  onChange,
}: {
  value: Interest[];
  onChange: (next: Interest[]) => void;
}) {
  const {
    search,
    setSearch,
    selected,
    suggestions,
    addInterest,
    removeInterest,
    canAddCustom,
    isFull,
  } = useInterestPicker(value, onChange);

  return (
    <div className="flex flex-col gap-6">
      <Input
        aria-label={t('onboarding.step.interests.search')}
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

      {isFull ? (
        <p className="text-sm text-muted">
          {t('interests.full', { max: MAX_INTERESTS })}
        </p>
      ) : (
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
      )}
    </div>
  );
}
