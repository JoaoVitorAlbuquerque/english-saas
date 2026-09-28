import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { OrderWordsItem } from './index';

const item = {
  id: 'a1-order-im-from-brazil',
  type: 'ORDER_WORDS' as const,
  prompt: 'Monte a frase: diga de onde você é.',
  content: { tokens: ['from', "I'm", 'Brazil'] },
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation: "A ordem é sujeito + verbo + de onde: I'm from Brazil.",
  correctAnswer: { text: "I'm from Brazil" },
};

export const Practice: Story = () => (
  <OrderWordsItem item={item} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <OrderWordsItem item={item} mode="practice" feedback={feedback} />
);

export const Preview: Story = () => (
  <OrderWordsItem item={item} mode="preview" feedback={feedback} />
);
