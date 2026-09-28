import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { DictationItem } from './index';

const item = {
  id: 'a1-dictation-im-from-brazil',
  type: 'DICTATION' as const,
  prompt: 'Ouça e escreva exatamente o que você ouviu.',
  content: {
    audioUrl:
      'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    maxPlays: 3,
  },
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation: 'A forma curta "I\'m" é o que se ouve na fala normal.',
  correctAnswer: { text: "I'm from Brazil." },
};

export const Practice: Story = () => (
  <DictationItem item={item} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <DictationItem item={item} mode="practice" feedback={feedback} />
);

export const Preview: Story = () => (
  <DictationItem item={item} mode="preview" feedback={feedback} />
);
