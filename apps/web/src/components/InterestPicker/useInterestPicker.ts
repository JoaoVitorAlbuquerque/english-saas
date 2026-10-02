import {
  SUGGESTED_INTERESTS,
  SUGGESTED_INTEREST_LABELS,
  type Interest,
} from '@english-saas/shared';
import { useMemo, useState } from 'react';

import { normalizeText, toTopicSlug } from './topic';

const DEFAULT_WEIGHT = 50;

/** Mesmo teto do back-end (`MAX_INTERESTS_PER_USER`). */
export const MAX_INTERESTS = 20;

/** Busca, sugestões e tema livre em cima de uma lista controlada pelo pai. */
export function useInterestPicker(
  value: Interest[],
  onChange: (next: Interest[]) => void,
) {
  const [search, setSearch] = useState('');

  const selectedTopics = new Set(value.map((interest) => interest.topic));
  const customSlug = toTopicSlug(search);
  const isFull = value.length >= MAX_INTERESTS;

  const suggestions = useMemo(
    () =>
      SUGGESTED_INTERESTS.filter((topic) => !selectedTopics.has(topic))
        .filter(
          (topic) =>
            search.trim().length === 0 ||
            normalizeText(SUGGESTED_INTEREST_LABELS[topic] ?? topic).includes(
              normalizeText(search),
            ),
        )
        .map((topic) => ({
          topic,
          label: SUGGESTED_INTEREST_LABELS[topic] ?? topic,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, value],
  );

  const canAddCustom =
    !isFull &&
    customSlug !== null &&
    !selectedTopics.has(customSlug) &&
    !SUGGESTED_INTERESTS.some(
      (topic) =>
        normalizeText(SUGGESTED_INTEREST_LABELS[topic] ?? topic) ===
        normalizeText(search),
    );

  function addInterest(topic: string) {
    const slug = toTopicSlug(topic);

    if (slug === null || selectedTopics.has(slug) || isFull) {
      return;
    }

    onChange([...value, { topic: slug, weight: DEFAULT_WEIGHT }]);
    setSearch('');
  }

  function removeInterest(topic: string) {
    onChange(value.filter((interest) => interest.topic !== topic));
  }

  return {
    search,
    setSearch,
    selected: value.map((interest) => ({
      topic: interest.topic,
      label: SUGGESTED_INTEREST_LABELS[interest.topic] ?? interest.topic,
    })),
    suggestions,
    addInterest,
    removeInterest,
    canAddCustom,
    isFull,
  };
}
