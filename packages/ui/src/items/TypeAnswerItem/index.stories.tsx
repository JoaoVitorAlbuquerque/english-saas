import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { TypeAnswerItem } from './index';

const item = {
  id: 'a1-type-shes-from-austin',
  type: 'TYPE_ANSWER' as const,
  prompt: 'Escreva em inglês: "Ela é de Austin."',
  content: { sourceText: 'Ela é de Austin.', hint: 'Use a forma curta.' },
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation:
    '"Ela é" vira "She is", e na fala "She\'s". "De Austin" é "from Austin".',
  correctAnswer: { text: "She's from Austin" },
};

export const Practice: Story = () => (
  <TypeAnswerItem item={item} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <TypeAnswerItem item={item} mode="practice" feedback={feedback} />
);

export const Preview: Story = () => (
  <TypeAnswerItem item={item} mode="preview" feedback={feedback} />
);
