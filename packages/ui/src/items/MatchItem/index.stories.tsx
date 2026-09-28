import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { MatchItem } from './index';

const item = {
  id: 'a1-match-pronoun-be',
  type: 'MATCH' as const,
  prompt: 'Ligue cada pronome à forma certa do verbo to be.',
  content: {
    lefts: ['I', 'he', 'they'],
    rights: ['am', 'are', 'is'],
  },
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation: 'I → am; he, she, it → is; you, we, they → are.',
  correctAnswer: {
    pairs: [
      { left: 'I', right: 'am' },
      { left: 'he', right: 'is' },
      { left: 'they', right: 'are' },
    ],
  },
};

export const Practice: Story = () => <MatchItem item={item} mode="practice" />;

export const PracticeCorreto: Story = () => (
  <MatchItem item={item} mode="practice" feedback={feedback} />
);

export const Preview: Story = () => (
  <MatchItem item={item} mode="preview" feedback={feedback} />
);
