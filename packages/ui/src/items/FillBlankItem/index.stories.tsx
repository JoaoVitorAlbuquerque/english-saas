import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { FillBlankItem } from './index';

const itemWithChoices = {
  id: 'a1-fill-biscuit-is-a-dog',
  type: 'FILL_BLANK' as const,
  prompt: 'Complete com o verbo to be.',
  content: {
    sentence: 'Biscuit ___ a dog.',
    hint: 'Biscuit é uma única criatura.',
    choices: ['is', 'am', 'are'],
  },
};

const freeTextItem = {
  id: 'a1-fill-are-you-new-here',
  type: 'FILL_BLANK' as const,
  prompt: 'Complete a pergunta.',
  content: { sentence: '___ you new here?', hint: 'A pergunta inverte.' },
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation: 'Biscuit é "it"/"he" — terceira pessoa do singular: is.',
  correctAnswer: { text: 'is' },
};

export const ComAlternativas: Story = () => (
  <FillBlankItem item={itemWithChoices} mode="practice" />
);

export const TextoLivre: Story = () => (
  <FillBlankItem item={freeTextItem} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <FillBlankItem item={itemWithChoices} mode="practice" feedback={feedback} />
);

export const Preview: Story = () => (
  <FillBlankItem item={itemWithChoices} mode="preview" feedback={feedback} />
);
