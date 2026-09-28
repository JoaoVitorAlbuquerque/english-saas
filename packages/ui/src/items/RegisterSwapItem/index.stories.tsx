import type { RegisterNote } from '@english-saas/shared';
import type { Story } from '@ladle/react';

import type { ItemFeedback } from '../types';
import { RegisterSwapItem } from './index';

const item = {
  id: 'a1-register-you-coming',
  type: 'REGISTER_SWAP' as const,
  prompt: 'Reescreva na estrutura gramatical completa.',
  content: { source: 'You coming?', direction: 'SPOKEN_TO_STANDARD' as const },
};

const registerNote: RegisterNote = {
  id: 'you-coming',
  spokenForm: 'You coming?',
  standardForm: 'Are you coming?',
  register: 'INFORMAL_SPOKEN',
  explanation:
    'Na fala o "are" some. Na forma completa ele volta para o começo.',
  whenToAvoid: 'Não use em e-mail formal.',
  cefrLevel: 'A1',
  skillId: null,
  deprecatedAt: null,
  replacedById: null,
};

const feedback: ItemFeedback = {
  isCorrect: true,
  score: 1,
  verdict: 'CORRECT',
  feedback: 'Isso mesmo.',
  explanation: registerNote.explanation,
  correctAnswer: { text: 'Are you coming?' },
};

export const Practice: Story = () => (
  <RegisterSwapItem item={item} mode="practice" />
);

export const PracticeCorreto: Story = () => (
  <RegisterSwapItem
    item={item}
    mode="practice"
    feedback={feedback}
    registerNote={registerNote}
  />
);

export const Preview: Story = () => (
  <RegisterSwapItem
    item={item}
    mode="preview"
    feedback={feedback}
    registerNote={registerNote}
  />
);
