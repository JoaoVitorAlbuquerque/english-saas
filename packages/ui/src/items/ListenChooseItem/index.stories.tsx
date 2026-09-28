import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { ListenChooseItem } from './index';

const item = {
  id: 'a1-listen-hes-friendly',
  type: 'LISTEN_CHOOSE' as const,
  prompt: 'Ouça e escolha o que a Maya disse.',
  content: {
    shuffle: false,
    audioUrl:
      'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    options: [
      { id: 'contracted', text: "He's very friendly." },
      { id: 'full', text: 'He is very friendly.' },
      { id: 'plural', text: 'They are very friendly.' },
    ],
  },
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation: 'Na fala, "he is" vira "he\'s" — sobra um "z" colado no "he".',
  correctAnswer: {
    optionIds: ['contracted'],
    texts: ["He's very friendly."],
  },
};

export const Practice: Story = () => (
  <ListenChooseItem item={item} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <ListenChooseItem item={item} mode="practice" feedback={feedback} />
);

export const Preview: Story = () => (
  <ListenChooseItem item={item} mode="preview" feedback={feedback} />
);
