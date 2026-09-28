import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { MultipleChoiceItem } from './index';

const item = {
  id: 'a1-be-i-am-maya',
  type: 'MULTIPLE_CHOICE' as const,
  prompt: 'Complete: I ___ Maya.',
  content: {
    shuffle: false,
    options: [
      { id: 'am', text: 'am' },
      { id: 'is', text: 'is' },
      { id: 'are', text: 'are' },
    ],
  },
};

const correctFeedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation: 'Com "I", o verbo to be é sempre "am".',
  correctAnswer: { optionIds: ['am'], texts: ['am'] },
};

const incorrectFeedback: ItemFeedback = {
  isCorrect: false,
  score: 0,
  verdict: 'INCORRECT',
  feedback: 'Não foi dessa vez. Veja a resposta e a explicação.',
  explanation: 'Com "I", o verbo to be é sempre "am".',
  correctAnswer: { optionIds: ['am'], texts: ['am'] },
};

export const Practice: Story = () => (
  <MultipleChoiceItem item={item} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <MultipleChoiceItem item={item} mode="practice" feedback={correctFeedback} />
);

export const PracticeErrado: Story = () => (
  <MultipleChoiceItem
    item={item}
    mode="practice"
    feedback={incorrectFeedback}
  />
);

export const Preview: Story = () => (
  <MultipleChoiceItem item={item} mode="preview" feedback={correctFeedback} />
);
