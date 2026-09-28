import {
  SUGGESTED_INTERESTS,
  SUGGESTED_INTEREST_LABELS,
  type Interest,
} from '@english-saas/shared';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOnboardingWizardStore } from '../../../stores/onboarding-wizard-store';

const DEFAULT_WEIGHT = 50;

function normalize(topic: string): string {
  return topic
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function useInterestsController() {
  const navigate = useNavigate();
  const interests = useOnboardingWizardStore((state) => state.interests);
  const setInterests = useOnboardingWizardStore((state) => state.setInterests);

  const [selected, setSelected] = useState<Interest[]>(interests);
  const [search, setSearch] = useState('');

  const selectedTopics = new Set(selected.map((interest) => interest.topic));

  const suggestions = useMemo(
    () =>
      SUGGESTED_INTERESTS.filter((topic) => !selectedTopics.has(topic))
        .filter(
          (topic) =>
            search.trim().length === 0 ||
            normalize(SUGGESTED_INTEREST_LABELS[topic] ?? topic).includes(
              normalize(search),
            ),
        )
        .map((topic) => ({
          topic,
          label: SUGGESTED_INTEREST_LABELS[topic] ?? topic,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, selected],
  );

  const canAddCustom =
    search.trim().length >= 2 &&
    !selectedTopics.has(normalize(search)) &&
    !SUGGESTED_INTERESTS.some(
      (topic) =>
        normalize(SUGGESTED_INTEREST_LABELS[topic] ?? topic) ===
        normalize(search),
    );

  function addInterest(topic: string) {
    const normalized = normalize(topic);
    if (normalized.length < 2 || selectedTopics.has(normalized)) {
      return;
    }

    setSelected((current) => [
      ...current,
      { topic: normalized, weight: DEFAULT_WEIGHT },
    ]);
    setSearch('');
  }

  function removeInterest(topic: string) {
    setSelected((current) =>
      current.filter((interest) => interest.topic !== topic),
    );
  }

  function handleContinue() {
    setInterests(selected);
    navigate('/onboarding/nivel');
  }

  return {
    search,
    setSearch,
    selected: selected.map((interest) => ({
      topic: interest.topic,
      label: SUGGESTED_INTEREST_LABELS[interest.topic] ?? interest.topic,
    })),
    suggestions,
    addInterest,
    removeInterest,
    canAddCustom,
    handleContinue,
  };
}
