import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { ReadingComprehensionItem } from './index';

const item = {
  id: 'a1-reading-lucas-austin',
  type: 'READING_COMPREHENSION' as const,
  prompt: 'Where is Lucas from?',
  content: {
    passage:
      "Lucas is 24. He's from Campinas, near São Paulo. He lives in Austin now, in apartment 4A. His neighbor is Maya. She's from Texas.",
    spans: [],
    shuffle: false,
    options: [
      { id: 'campinas', text: 'Campinas' },
      { id: 'austin', text: 'Austin' },
      { id: 'texas', text: 'Texas' },
    ],
  },
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation:
    'O texto diz onde ele mora hoje (Austin) e de onde ele é (Campinas). A pergunta é a origem.',
  correctAnswer: { optionIds: ['campinas'], texts: ['Campinas'] },
};

export const Practice: Story = () => (
  <ReadingComprehensionItem item={item} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <ReadingComprehensionItem item={item} mode="practice" feedback={feedback} />
);

export const Preview: Story = () => (
  <ReadingComprehensionItem item={item} mode="preview" feedback={feedback} />
);
